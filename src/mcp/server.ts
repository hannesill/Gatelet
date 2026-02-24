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
import { config } from '../config.js';

let toolRegistry: Map<string, RegisteredTool>;

export function refreshToolRegistry(): void {
  toolRegistry = buildToolRegistry();
}

export function getRegisteredToolCount(): number {
  return toolRegistry?.size ?? 0;
}

function createMcpServer(): McpServer {
  const mcpServer = new McpServer({
    name: 'gatelet',
    version: '0.1.0',
  });

  for (const [name, registered] of toolRegistry) {
    const toolDef = registered.tool;

    mcpServer.tool(
      name,
      toolDef.description,
      toolDef.inputSchema,
      async (params: Record<string, unknown>) => {
        return handleToolCall(name, params, registered);
      },
    );
  }

  return mcpServer;
}

export function startMcpServer(): void {
  toolRegistry = buildToolRegistry();

  // Each session gets its own McpServer with the latest tools at time of connection.
  // This ensures new connections/tools are picked up without restarting.
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

  const server = http.createServer(async (req, res) => {
    if (req.url !== '/mcp') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const apiKey = authenticateBearer(req.headers.authorization);
    if (!apiKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Collect body
    const bodyChunks: Buffer[] = [];
    for await (const chunk of req) {
      bodyChunks.push(chunk);
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
      await session.transport.handleRequest(req, res, body);
      return;
    }

    // For new connections, check if this is an init request
    const isInit = Array.isArray(body)
      ? body.some((msg: Record<string, unknown>) => msg.method === 'initialize')
      : (body as Record<string, unknown>)?.method === 'initialize';

    if (isInit) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
      });

      // Create a fresh McpServer with current tools for this session
      const mcpServer = createMcpServer();

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);

      if (transport.sessionId) {
        sessions.set(transport.sessionId, { transport, server: mcpServer });
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
  });

  server.listen(config.MCP_PORT, () => {
    console.log(`MCP server listening on :${config.MCP_PORT}`);
  });
}

async function handleToolCall(
  toolName: string,
  params: Record<string, unknown>,
  registered: RegisteredTool,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const startTime = Date.now();
  const originalParams = structuredClone(params);

  const conn = getConnectionWithCredentials(registered.connectionId);
  if (!conn) {
    insertAuditEntry({
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
    policy = parsePolicy(conn.policy_yaml);
  } catch {
    insertAuditEntry({
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
    return {
      content: [{ type: 'text', text: 'Error: Provider not found' }],
    };
  }

  try {
    let result: unknown;
    try {
      result = await provider.execute(
        toolName,
        policyResult.mutatedParams,
        conn.credentials,
      );
    } catch (err: unknown) {
      if (
        provider.refreshCredentials &&
        err instanceof Error &&
        (err.message.includes('invalid_grant') ||
          err.message.includes('Token has been expired') ||
          err.message.includes('401'))
      ) {
        const newCreds = await provider.refreshCredentials(conn.credentials);
        updateConnectionCredentials(conn.id, newCreds);
        result = await provider.execute(
          toolName,
          policyResult.mutatedParams,
          newCreds,
        );
      } else {
        throw err;
      }
    }

    const responseText = JSON.stringify(result, null, 2);

    insertAuditEntry({
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      mutated_params: policyResult.mutatedParams,
      result: 'allowed',
      response_summary: responseText.slice(0, 500),
      duration_ms: Date.now() - startTime,
    });

    return {
      content: [{ type: 'text', text: responseText }],
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    insertAuditEntry({
      connection_id: registered.connectionId,
      tool_name: toolName,
      original_params: originalParams,
      mutated_params: policyResult.mutatedParams,
      result: 'error',
      deny_reason: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
    };
  }
}
