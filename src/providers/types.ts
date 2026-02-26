import type { z } from 'zod';

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  builtinClientId?: string;
  builtinClientSecret?: string;
  envClientId: string;
  envClientSecret: string;
  settingsKeyPrefix: string;
  extraAuthorizeParams?: Record<string, string>;
  discoverAccount(accessToken: string): Promise<string>;
}

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
  presets?: Record<string, string>;
  oauth?: OAuthConfig;

  execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
    connectionSettings?: Record<string, unknown>,
  ): Promise<unknown>;

  refreshCredentials?(
    credentials: Record<string, unknown>,
    oauthClientInfo: { clientId: string; clientSecret: string },
  ): Promise<Record<string, unknown>>;
}
