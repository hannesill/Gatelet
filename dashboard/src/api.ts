import type { Status, ApiKey, AuditResponse, DoctorCheck, PolicyValidation, ProviderReference } from './types';

class AuthError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'AuthError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    throw new AuthError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export { AuthError };

/** Dispatch this event to signal session expiration to App.tsx */
export function dispatchAuthExpired(): void {
  window.dispatchEvent(new Event('auth-expired'));
}

export const api = {
  login: (token: string) =>
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),

  logout: () => fetch('/api/logout', { method: 'POST' }),

  getStatus: () => request<Status>('/api/status'),

  getConnections: () => request<Array<{ id: string; provider_id: string; account_name: string; policy_yaml: string; created_at: string; updated_at: string }>>('/api/connections'),

  deleteConnection: (id: string) => request<{ deleted: boolean }>(`/api/connections/${id}`, { method: 'DELETE' }),

  toggleConnection: (id: string, enabled: boolean) =>
    request<{ updated: boolean; enabled: boolean }>(`/api/connections/${id}/enabled`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  getConnectionSettings: (id: string) => request<Record<string, unknown>>(`/api/connections/${id}/settings`),

  saveConnectionSettings: (id: string, settings: Record<string, unknown>) =>
    request<{ updated: boolean }>(`/api/connections/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getPolicy: async (id: string): Promise<string> => {
    const res = await fetch(`/api/connections/${id}/policy`);
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`Failed to load policy (HTTP ${res.status})`);
    return res.text();
  },

  savePolicy: async (id: string, yaml: string) => {
    const res = await fetch(`/api/connections/${id}/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/yaml' },
      body: yaml,
    });
    if (res.status === 401) throw new AuthError();
    const body = await res.json().catch(() => ({ error: 'Save failed' }));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  },

  validatePolicy: async (id: string, yaml: string): Promise<PolicyValidation> => {
    const res = await fetch(`/api/connections/${id}/policy/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/yaml' },
      body: yaml,
    });
    if (res.status === 401) throw new AuthError();
    const body = await res.json().catch(() => ({ valid: false, errors: ['Validation request failed'] }));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  },

  getApiKeys: () => request<ApiKey[]>('/api/api-keys'),

  createApiKey: (name: string) => request<{ id: string; key: string }>('/api/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),

  revokeApiKey: (id: string) => request<{ revoked: boolean }>(`/api/api-keys/${id}`, { method: 'DELETE' }),

  getAudit: (params: Record<string, string>) =>
    request<AuditResponse>(`/api/audit?${new URLSearchParams(params)}`),

  getDoctor: () => request<DoctorCheck[]>('/api/doctor'),

  fixDoctor: () => request<DoctorCheck[]>('/api/doctor/fix', { method: 'POST' }),

  getProviderReference: (id: string) => request<ProviderReference>(`/api/providers/${id}/reference`),

  testConnection: (id: string) =>
    request<{ ok: boolean; preview?: string; error?: string }>(`/api/connections/${id}/test`, { method: 'POST' }),

  getProviderPreset: async (providerId: string, preset: string): Promise<string> => {
    const res = await fetch(`/api/providers/${providerId}/presets/${preset}`);
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`Failed to load preset (HTTP ${res.status})`);
    return res.text();
  },

  getOAuthSettings: (providerId: string) => request<{ configured: boolean; client_id?: string }>(`/api/settings/oauth/${providerId}`),

  saveOAuthSettings: (providerId: string, clientId: string, clientSecret: string) =>
    request<{ saved: boolean }>(`/api/settings/oauth/${providerId}`, {
      method: 'PUT',
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    }),

  startSetup: () =>
    request<{ ok: boolean }>('/api/setup-status', {
      method: 'POST',
      body: JSON.stringify({ completed: false }),
    }),

  completeSetup: () =>
    request<{ ok: boolean }>('/api/setup-status', {
      method: 'POST',
      body: JSON.stringify({ completed: true }),
    }),
};
