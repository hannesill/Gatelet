export interface ConnectionWithMeta {
  id: string;
  provider_id: string;
  account_name: string;
  displayName: string;
  enabledTools: number;
  totalTools: number;
  tokenStatus: 'valid' | 'expired' | 'unknown';
  tokenExpiresAt?: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  policy_yaml: string;
}

export interface Tool {
  name: string;
  operation: string;
  enabled: boolean;
  connectionId: string;
  providerId: string;
}

export interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface Status {
  uptime: number;
  connections: ConnectionWithMeta[];
  tools: Tool[];
  apiKeys: { total: number; active: number };
  oauthProviders: OAuthProvider[];
  setupCompleted: boolean;
  runtime?: { docker: boolean };
}

export interface OAuthProvider {
  id: string;
  displayName: string;
  configured: boolean;
  credentialSource: 'user' | 'env' | 'builtin' | 'none';
}

export interface AuditEntry {
  id: string;
  api_key_id: string | null;
  connection_id: string | null;
  tool_name: string;
  result: string;
  deny_reason: string | null;
  original_params: string | null;
  mutated_params: string | null;
  response_summary: string | null;
  duration_ms: number | null;
  timestamp: string;
}

export interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

export interface DoctorCheck {
  id: string;
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
  fixable: boolean;
  fixed: boolean;
}

export interface PolicyValidation {
  valid: boolean;
  error?: string;
  tools?: Array<{ name: string; operation: string; enabled: boolean }>;
  warnings?: string[];
}

export interface ProviderReference {
  provider: { id: string; displayName: string };
  operations: Array<{
    name: string;
    policyOperation: string;
    fields: string[];
  }>;
  constraints: Array<{ rule: string; requiresValue: boolean }>;
  mutations: Array<{ action: string; requiresValue: boolean }>;
  example: string;
  presets?: string[];
}
