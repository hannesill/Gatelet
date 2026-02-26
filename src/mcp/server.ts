import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'node:http';
import { buildToolRegistry, type RegisteredTool } from './tool-registry.js';
import { authenticateBearer } from './auth.js';
import { getConnectionWithCredentials, updateConnectionCredentials } from '../db/connections.js';
import { parsePolicy } from '../policy/parser.js';
import { evaluate } from '../policy/engine.js';
import { getProvider } from '../providers/registry.js';
import { insertAuditEntry } from '../db/audit.js';
import { getOAuthClientId, getOAuthClientSecret } from '../db/settings.js';
import { config } from '../config.js';
import { stripUnknownParams, applyFieldPolicy } from './param-filter.js';
import { sanitizeUpstreamError } from './error-sanitizer.js';

let toolRegistry: Map<string, RegisteredTool>;

// Per-connection mutex for token refresh to prevent concurrent refreshes
const refreshLocks = new Map<string, Promise<Record<string, unknown>>>();

export function refreshToolRegistry(): void {
  toolRegistry = buildToolRegistry();
}

export function getRegisteredToolCount(): number {
  return toolRegistry?.size ?? 0;
}

function createMcpServer(apiKeyId: string): McpServer {
  const mcpServer = new McpServer({
    name: 'gatelet',
    version: '0.2.0',
  });

  for (const [name, registered] of toolRegistry) {
    const toolDef = registered.tool;

    mcpServer.tool(
      name,
      toolDef.description,
      toolDef.inputSchema,
      async (params: Record<string, unknown>) => {
        return handleToolCall(name, params, registered, apiKeyId);
      },
    );
  }

  return mcpServer;
}

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const MAX_SESSIONS = 100;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function startMcpServer(): http.Server {
  toolRegistry = buildToolRegistry();

  // Each session gets its own McpServer with the latest tools at time of connection.
  // This ensures new connections/tools are picked up without restarting.
  const sessions = new Map<string, {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
    apiKeyId: string;
    lastActive: number;
  }>();

  // Periodic session cleanup
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActive > SESSION_TTL_MS) {
        session.transport.close();
        sessions.delete(id);
      }
    }
  }, 60 * 1000);
  cleanupInterval.unref();

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url !== '/mcp') {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const clientIp = req.socket.remoteAddress || 'unknown';
      const apiKey = authenticateBearer(req.headers.authorization, clientIp);
      if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // Reject oversized requests early via Content-Length
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        return;
      }

      // Collect body with size limit
      const bodyChunks: Buffer[] = [];
      let bodySize = 0;
      let aborted = false;
      try {
        for await (const chunk of req) {
          bodySize += chunk.length;
          if (bodySize > MAX_BODY_SIZE) {
            aborted = true;
            break;
          }
          bodyChunks.push(chunk);
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request aborted' }));
        return;
      }
      if (aborted) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        return;
      }

      const bodyStr = Buffer.concat(bodyChunks).toString('utf-8');
      let body: unknown;
      try {
        body = bodyStr ? JSON.parse(bodyStr) : undefined;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Check for existing session
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        // Verify the same API key that created the session is being used
        if (session.apiKeyId !== apiKey.id) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API key does not match session' }));
          return;
        }
        session.lastActive = Date.now();
        await session.transport.handleRequest(req, res, body);
        return;
      }

      // For new connections, check if this is an init request
      const isInit = Array.isArray(body)
        ? body.some((msg: unknown) => msg != null && typeof msg === 'object' && (msg as Record<string, unknown>).method === 'initialize')
        : body != null && typeof body === 'object' && (body as Record<string, unknown>).method === 'initialize';

      if (isInit) {
        // Enforce session limit
        if (sessions.size >= MAX_SESSIONS) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Too many active sessions' }));
          return;
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          enableJsonResponse: true,
        });

        // Create a fresh McpServer with current tools for this session
        const mcpServer = createMcpServer(apiKey.id);

        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, body);

        if (transport.sessionId) {
          sessions.set(transport.sessionId, { transport, server: mcpServer, apiKeyId: apiKey.id, lastActive: Date.now() });
        }
      } else {
        // Non-init request without valid session
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session. Send an initialize request first.' },
          id: null,
        }));
      }
    } catch (err) {
      console.error('MCP server error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  // In Docker, bind to 0.0.0.0 — Docker port forwarding requires it.
  // Outside Docker, bind to 127.0.0.1 to avoid exposing the MCP port on the LAN.
  const hostname = process.env.GATELET_DATA_DIR === '/data' ? '0.0.0.0' : '127.0.0.1';
  server.listen(config.MCP_PORT, hostname, () => {
    console.log(`MCP server listening on ${hostname}:${config.MCP_PORT}`);
  });

  return server;
}

export async function handleToolCall(
  toolName: string,
  params: Record<string, unknown>,
  registered: RegisteredTool,
  apiKeyId?: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const startTime = Date.now();
  const originalParams = structuredClone(params);

  const conn = getConnectionWithCredentials(registered.connectionId);
  let settings: Record<string, unknown> = {};
  try {
    settings = conn ? JSON.parse(conn.settings_json || '{}') : {};
  } catch {
    // Corrupted settings_json — use empty defaults
  }
  if (!conn) {
    insertAuditEntry({
      api_key_id: apiKeyId,
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      result: 'error',
      deny_reason: 'Connection not found',
    });
    return {
      content: [{ type: 'text', text: 'Error: Connection not found' }],
    };
  }

  let policy;
  try {
    policy = parsePolicy(conn.policy_yaml).policy;
  } catch {
    insertAuditEntry({
      api_key_id: apiKeyId,
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      result: 'error',
      deny_reason: 'Invalid policy configuration',
    });
    return {
      content: [{ type: 'text', text: 'Error: Invalid policy configuration' }],
    };
  }

  const policyResult = evaluate(policy, registered.policyOperation, params);

  if (policyResult.action === 'deny') {
    insertAuditEntry({
      api_key_id: apiKeyId,
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      result: 'denied',
      deny_reason: policyResult.reason,
      duration_ms: Date.now() - startTime,
    });
    return {
      content: [{ type: 'text', text: `Denied: ${policyResult.reason}` }],
    };
  }

  const provider = getProvider(registered.providerId);
  if (!provider) {
    insertAuditEntry({
      api_key_id: apiKeyId,
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      result: 'error',
      deny_reason: `Provider not found: ${registered.providerId}`,
    });
    return {
      content: [{ type: 'text', text: 'Error: Provider not found' }],
    };
  }

  // Strip fields not in tool's inputSchema (FINDING-08)
  const filteredParams = stripUnknownParams(
    policyResult.mutatedParams,
    registered.tool.inputSchema,
  );

  // Apply policy-level field overrides if present
  const finalParams = applyFieldPolicy(filteredParams, policyResult.fieldPolicy);

  // Track stripped fields for audit
  const strippedFields = Object.keys(policyResult.mutatedParams)
    .filter(k => !(k in finalParams));

  try {
    let result: unknown;
    try {
      result = await provider.execute(
        toolName,
        finalParams,
        conn.credentials,
        policyResult.guards,
        settings,
      );
    } catch (err: unknown) {
      if (
        provider.refreshCredentials &&
        err instanceof Error &&
        (err.message.includes('invalid_grant') ||
          err.message.includes('Token has been expired') ||
          err.message.includes('401'))
      ) {
        // Use per-connection mutex to prevent concurrent refresh races
        let refreshPromise = refreshLocks.get(conn.id);
        if (!refreshPromise) {
          const clientId = getOAuthClientId(provider);
          const clientSecret = getOAuthClientSecret(provider);
          refreshPromise = provider.refreshCredentials(
            conn.credentials,
            { clientId: clientId ?? '', clientSecret: clientSecret ?? '' },
          ).finally(() => refreshLocks.delete(conn.id));
          refreshLocks.set(conn.id, refreshPromise);
        }
        const newCreds = await refreshPromise;
        updateConnectionCredentials(conn.id, newCreds);
        result = await provider.execute(
          toolName,
          finalParams,
          newCreds,
          policyResult.guards,
          settings,
        );
      } else {
        throw err;
      }
    }

    const responseText = JSON.stringify(result, null, 2);

    insertAuditEntry({
      api_key_id: apiKeyId,
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      mutated_params: finalParams,
      result: 'allowed',
      response_summary: strippedFields.length > 0
        ? JSON.stringify({ stripped_fields: strippedFields, response: responseText.slice(0, 400) })
        : responseText.slice(0, 500),
      duration_ms: Date.now() - startTime,
    });

    return {
      content: [{ type: 'text', text: responseText }],
    };
  } catch (err: unknown) {
    const sanitized = sanitizeUpstreamError(err, toolName);

    console.error(sanitized.logMessage);

    insertAuditEntry({
      api_key_id: apiKeyId,
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      mutated_params: finalParams,
      result: 'error',
      deny_reason: sanitized.logMessage,
      duration_ms: Date.now() - startTime,
    });

    return {
      content: [{ type: 'text', text: `Error: ${sanitized.agentMessage}` }],
    };
  }
}
