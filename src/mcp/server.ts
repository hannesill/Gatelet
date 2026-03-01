import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisteredTool as SdkRegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'node:http';
import { buildToolRegistry, type RegisteredTool } from './tool-registry.js';
import { authenticateBearer, isMcpRateLimited } from './auth.js';
import { getConnectionWithCredentials, getConnectionSettings, setConnectionNeedsReauth } from '../db/connections.js';
import { parsePolicy } from '../policy/parser.js';
import { evaluate } from '../policy/engine.js';
import { getProvider } from '../providers/registry.js';
import type { Provider } from '../providers/types.js';
import { insertAuditEntry } from '../db/audit.js';
import { config } from '../config.js';
import { stripUnknownParams, applyFieldPolicy } from './param-filter.js';
import { sanitizeUpstreamError } from './error-sanitizer.js';
import { GateletError } from '../providers/gatelet-error.js';
import { isAuthError, refreshConnectionCredentials } from '../providers/token-refresh.js';
import { VERSION } from '../version.js';

/** Thrown when token refresh confirms the connection is permanently broken. */
class PermanentAuthError extends Error {
  constructor(toolName: string, cause: unknown) {
    const msg = `Authentication failed for ${toolName}. This connection needs to be re-authorized by the admin in the Gatelet dashboard.`;
    super(msg, { cause });
  }
}

/**
 * Execute a tool call, automatically refreshing credentials on auth errors.
 * Throws PermanentAuthError if refresh itself fails with an auth error.
 */
async function executeWithRefresh(
  provider: Provider,
  toolName: string,
  params: Record<string, unknown>,
  credentials: Record<string, unknown>,
  connectionId: string,
  guards: unknown,
  settings: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await provider.execute(toolName, params, credentials, guards, settings);
  } catch (err: unknown) {
    if (!provider.refreshCredentials || !isAuthError(err)) throw err;

    try {
      const newCreds = await refreshConnectionCredentials(connectionId, provider, credentials);
      return await provider.execute(toolName, params, newCreds, guards, settings);
    } catch (retryErr: unknown) {
      if (isAuthError(retryErr)) {
        setConnectionNeedsReauth(connectionId, true);
        throw new PermanentAuthError(toolName, retryErr);
      }
      throw retryErr;
    }
  }
}

let toolRegistry: Map<string, RegisteredTool>;

// Active MCP sessions — module-scoped so refreshToolRegistry() can notify them.
const sessions = new Map<string, {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  apiKeyId: string;
  lastActive: number;
  toolHandles: Map<string, SdkRegisteredTool>;
}>();

/**
 * Rebuild the tool registry from the database and notify all active MCP
 * sessions so connected clients see the updated tool list immediately.
 */
export function refreshToolRegistry(): void {
  toolRegistry = buildToolRegistry();

  for (const [sessionId, session] of sessions) {
    try {
      // Remove tools no longer in the registry
      for (const [name, handle] of session.toolHandles) {
        if (!toolRegistry.has(name)) {
          handle.remove();
          session.toolHandles.delete(name);
        }
      }

      // Add tools that are new in the registry
      for (const [name, registered] of toolRegistry) {
        if (!session.toolHandles.has(name)) {
          const toolDef = registered.tool;
          const handle = session.server.tool(
            name,
            toolDef.description,
            toolDef.inputSchema,
            async (params: Record<string, unknown>) => {
              const current = toolRegistry.get(name);
              if (!current) {
                return { content: [{ type: 'text' as const, text: 'Error: Tool no longer available' }] };
              }
              return handleToolCall(name, params, current, session.apiKeyId);
            },
          );
          session.toolHandles.set(name, handle);
        }
      }

      session.server.sendToolListChanged();
    } catch (err) {
      console.error(`Failed to update tools for session ${sessionId}:`, err);
    }
  }
}

export function getRegisteredToolCount(): number {
  return toolRegistry?.size ?? 0;
}

function registerToolsOnServer(
  mcpServer: McpServer,
  apiKeyId: string,
): Map<string, SdkRegisteredTool> {
  const handles = new Map<string, SdkRegisteredTool>();

  for (const [name, registered] of toolRegistry) {
    const toolDef = registered.tool;

    const handle = mcpServer.tool(
      name,
      toolDef.description,
      toolDef.inputSchema,
      async (params: Record<string, unknown>) => {
        // Look up from current registry so policy changes are always reflected
        const current = toolRegistry.get(name);
        if (!current) {
          return { content: [{ type: 'text' as const, text: 'Error: Tool no longer available' }] };
        }
        return handleToolCall(name, params, current, apiKeyId);
      },
    );
    handles.set(name, handle);
  }

  return handles;
}

function createMcpServer(apiKeyId: string): {
  server: McpServer;
  toolHandles: Map<string, SdkRegisteredTool>;
} {
  const server = new McpServer({
    name: 'gatelet',
    version: VERSION,
  });
  const toolHandles = registerToolsOnServer(server, apiKeyId);
  return { server, toolHandles };
}

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const MAX_SESSIONS = 20;
const SESSION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export function startMcpServer(): http.Server {
  toolRegistry = buildToolRegistry();

  // Periodic cleanup of idle sessions
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
      if (isMcpRateLimited(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many failed attempts. Try again later.' }));
        return;
      }
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
        // Evict least-recently-used session if at capacity
        if (sessions.size >= MAX_SESSIONS) {
          let oldestId: string | undefined;
          let oldestTime = Infinity;
          for (const [id, session] of sessions) {
            if (session.lastActive < oldestTime) {
              oldestTime = session.lastActive;
              oldestId = id;
            }
          }
          if (oldestId) {
            sessions.get(oldestId)!.transport.close();
            sessions.delete(oldestId);
          }
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          enableJsonResponse: true,
        });

        // Create a fresh McpServer with current tools for this session
        const { server: mcpServer, toolHandles } = createMcpServer(apiKey.id);

        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, body);

        if (transport.sessionId) {
          sessions.set(transport.sessionId, { transport, server: mcpServer, toolHandles, apiKeyId: apiKey.id, lastActive: Date.now() });
        }
      } else if (sessionId) {
        // Known session ID that no longer exists (expired or server restarted).
        // MCP spec requires 404 so clients know to re-initialize.
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Session not found. Please re-initialize.' },
          id: null,
        }));
      } else {
        // No session ID and not an init request
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: Send an initialize request first.' },
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
  const hostname = config.IS_DOCKER ? '0.0.0.0' : '127.0.0.1';
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
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const startTime = Date.now();
  const originalParams = structuredClone(params);

  const conn = getConnectionWithCredentials(registered.connectionId);
  const settings = conn ? getConnectionSettings(registered.connectionId) : {};
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
      isError: true,
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
      isError: true,
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
      isError: true,
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
      isError: true,
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
    const result = await executeWithRefresh(
      provider, toolName, finalParams, conn.credentials,
      conn.id, policyResult.guards, settings,
    );

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
    if (err instanceof PermanentAuthError) {
      const cause = err.cause;
      const detail = cause instanceof Error ? cause.message : String(cause);

      insertAuditEntry({
        api_key_id: apiKeyId,
        connection_id: registered.connectionId,
        tool_name: toolName,
        original_params: originalParams,
        mutated_params: finalParams,
        result: 'error',
        deny_reason: `Authentication permanently failed: ${detail}`,
        duration_ms: Date.now() - startTime,
      });

      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }

    if (err instanceof GateletError) {
      insertAuditEntry({
        api_key_id: apiKeyId,
        connection_id: registered.connectionId,
        tool_name: toolName,
        original_params: originalParams,
        mutated_params: finalParams,
        result: 'error',
        deny_reason: err.message,
        duration_ms: Date.now() - startTime,
      });

      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }

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
      isError: true,
    };
  }
}
