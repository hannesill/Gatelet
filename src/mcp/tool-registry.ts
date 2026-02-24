import { listConnections } from '../db/connections.js';
import { getProvider } from '../providers/registry.js';
import { parsePolicy } from '../policy/parser.js';
import type { ToolDefinition } from '../providers/types.js';

export interface RegisteredTool {
  tool: ToolDefinition;
  connectionId: string;
  providerId: string;
  policyOperation: string;
}

export function buildToolRegistry(): Map<string, RegisteredTool> {
  const registry = new Map<string, RegisteredTool>();
  const connections = listConnections();

  for (const conn of connections) {
    const provider = getProvider(conn.provider_id);
    if (!provider) continue;

    let policy;
    try {
      policy = parsePolicy(conn.policy_yaml);
    } catch {
      continue;
    }

    for (const tool of provider.tools) {
      const opPolicy = policy.operations[tool.policyOperation];
      if (!opPolicy || !opPolicy.allow) continue;

      registry.set(tool.name, {
        tool,
        connectionId: conn.id,
        providerId: conn.provider_id,
        policyOperation: tool.policyOperation,
      });
    }
  }

  return registry;
}
