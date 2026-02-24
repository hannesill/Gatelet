import type { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  policyOperation: string;
  inputSchema: Record<string, z.ZodTypeAny>;
}

export interface Provider {
  id: string;
  displayName: string;
  tools: ToolDefinition[];
  defaultPolicyYaml: string;

  execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
  ): Promise<unknown>;

  refreshCredentials?(
    credentials: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}
