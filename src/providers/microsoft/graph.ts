import type { OAuthConfig } from '../types.js';

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export function validatePathSegment(value: string, name: string): void {
  if (/[\/\\?#&=\s\x00]|\.\./.test(value)) {
    throw new Error(`Invalid ${name}: contains disallowed characters`);
  }
}

/** Validate OData $filter to prevent injection. Only allow safe filter expressions. */
export function validateODataFilter(filter: string): void {
  // Allow only: field comparisons (eq, ne, gt, ge, lt, le), contains(), startswith(),
  // logical operators (and, or, not), ISO datetime literals, quoted strings, and whitespace
  const safePattern = /^[\w/.':\-\s,()]+$/;
  if (!safePattern.test(filter)) {
    throw new Error('Invalid filter: contains disallowed characters');
  }
  // Block known dangerous OData functions
  const dangerous = /\$(expand|select|count|search|compute|apply)/i;
  if (dangerous.test(filter)) {
    throw new Error('Invalid filter: contains disallowed OData operators');
  }
}

export async function graphFetch(
  path: string,
  credentials: Record<string, unknown>,
  options?: { method?: string; body?: unknown },
): Promise<unknown> {
  const method = options?.method ?? 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.access_token as string}`,
  };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft Graph API error (${res.status}): ${errText}`);
  }

  // sendMail returns 202 with no body; move/delete may return 204
  if (res.status === 202 || res.status === 204) {
    return {};
  }

  return res.json();
}

export async function refreshMicrosoftTokens(
  credentials: Record<string, unknown>,
  oauthClientInfo: { clientId: string; clientSecret?: string },
): Promise<{
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
}> {
  const params: Record<string, string> = {
    client_id: oauthClientInfo.clientId,
    refresh_token: credentials.refresh_token as string,
    grant_type: 'refresh_token',
  };
  // Public client (PKCE) — no client_secret needed for refresh
  if (oauthClientInfo.clientSecret) {
    params.client_secret = oauthClientInfo.clientSecret;
  }
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed: ${errText}`);
  }

  const tokens = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number; token_type: string };
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? (credentials.refresh_token as string),
    expiry_date: typeof tokens.expires_in === 'number'
      ? Date.now() + tokens.expires_in * 1000
      : (credentials.expiry_date as number),
    token_type: tokens.token_type,
  };
}

export function buildMicrosoftOAuthConfig(
  scopes: string[],
  scopeVariants?: Record<string, string[]>,
): OAuthConfig {
  return {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes,
    builtinClientId: '1e200574-2d1a-4103-919d-2cbade780983',
    // No builtinClientSecret — registered as a public client, uses PKCE instead.
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
    settingsKeyPrefix: 'microsoft',
    pkce: true,
    oauthScopeVariants: scopeVariants,
    async discoverAccount(accessToken: string): Promise<string> {
      const res = await fetch(`${GRAPH_BASE}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return 'unknown';
      const data = await res.json() as { mail?: string; userPrincipalName?: string };
      return data.mail ?? data.userPrincipalName ?? 'unknown';
    },
  };
}
