import { Hono } from 'hono';
import {
  listConnections,
  getConnection,
  getConnectionWithCredentials,
  createConnection,
  deleteConnection,
  findConnectionByProviderAccount,
  updateConnectionCredentials,
  updateConnectionPolicy,
  getConnectionSettings,
  updateConnectionSettings,
  toggleConnectionEnabled,
  setConnectionNeedsReauth,
} from '../../db/connections.js';
import { getProvider } from '../../providers/registry.js';
import { getOAuthClientId, getOAuthClientSecret, getSetting } from '../../db/settings.js';
import { isAuthError, refreshConnectionCredentials } from '../../providers/token-refresh.js';
import { config } from '../../config.js';
import { refreshToolRegistry } from '../../mcp/server.js';
import crypto from 'node:crypto';

/** Maps provider ID to the safe read-only tool name and params used for testing. */
const TEST_OPERATIONS: Record<string, { tool: string; params: Record<string, unknown> }> = {
  google_gmail: { tool: 'gmail_search', params: { maxResults: 1 } },
  google_calendar: { tool: 'calendar_list_calendars', params: {} },
  outlook_calendar: { tool: 'outlook_list_calendars', params: {} },
  outlook_mail: { tool: 'outlook_mail_search', params: { maxResults: 1 } },
};

/** Generate a human-readable preview from a test result. */
function testPreview(providerId: string, result: unknown): string {
  try {
    if (providerId === 'google_gmail') {
      const messages = (result as any)?.messages;
      if (Array.isArray(messages)) {
        const count = messages.length;
        return count > 0 ? `Found ${count} recent message${count === 1 ? '' : 's'}` : 'Inbox accessible (no messages matched)';
      }
      return 'Gmail connected successfully';
    }
    if (providerId === 'google_calendar') {
      const items = (result as any)?.items;
      if (Array.isArray(items)) {
        return `Found ${items.length} calendar${items.length === 1 ? '' : 's'}`;
      }
      return 'Google Calendar connected successfully';
    }
    if (providerId === 'outlook_calendar') {
      const value = (result as any)?.value;
      if (Array.isArray(value)) {
        return `Found ${value.length} calendar${value.length === 1 ? '' : 's'}`;
      }
      return 'Outlook Calendar connected successfully';
    }
    if (providerId === 'outlook_mail') {
      const messages = (result as any)?.messages;
      if (Array.isArray(messages)) {
        const count = messages.length;
        return count > 0 ? `Found ${count} recent message${count === 1 ? '' : 's'}` : 'Mailbox accessible (no messages matched)';
      }
      return 'Outlook Mail connected successfully';
    }
    return 'Connection verified';
  } catch {
    return 'Connection verified';
  }
}

// OAuth state store — maps nonce -> session data, auto-expires after 10 minutes
const oauthStates = new Map<string, { token: string; providerId: string; codeVerifier?: string; returnOrigin?: string; accessLevel?: string; expires: number }>();

function createOAuthState(adminToken: string, providerId: string, codeVerifier?: string, returnOrigin?: string, accessLevel?: string): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  oauthStates.set(nonce, { token: adminToken, providerId, codeVerifier, returnOrigin, accessLevel, expires: Date.now() + 10 * 60 * 1000 });
  // Clean up expired entries
  for (const [key, value] of oauthStates) {
    if (value.expires < Date.now()) oauthStates.delete(key);
  }
  return nonce;
}

function redeemOAuthState(nonce: string): { token: string; providerId: string; codeVerifier?: string; returnOrigin?: string; accessLevel?: string } | null {
  const entry = oauthStates.get(nonce);
  if (!entry || entry.expires < Date.now()) {
    oauthStates.delete(nonce);
    return null;
  }
  oauthStates.delete(nonce);
  return { token: entry.token, providerId: entry.providerId, codeVerifier: entry.codeVerifier, returnOrigin: entry.returnOrigin, accessLevel: entry.accessLevel };
}

/** Generate PKCE code_verifier and S256 code_challenge */
function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

import { stripSensitivePatterns } from './sanitize.js';

const app = new Hono();

app.get('/connections', (c) => {
  const connections = listConnections();
  return c.json(connections);
});

app.post('/connections', async (c) => {
  const body = await c.req.json();
  const { provider_id, account_name, credentials, policy_yaml } = body;

  if (!provider_id || !account_name || !credentials) {
    return c.json({ error: 'Missing required fields: provider_id, account_name, credentials' }, 400);
  }

  const existing = findConnectionByProviderAccount(provider_id, account_name);
  if (existing) {
    updateConnectionCredentials(existing.id, credentials);
    if (policy_yaml) {
      updateConnectionPolicy(existing.id, policy_yaml);
    }
    refreshToolRegistry();
    return c.json({ ...existing, updated: true }, 200);
  }

  const provider = getProvider(provider_id);
  const yaml = policy_yaml ?? provider?.defaultPolicyYaml.replace('{account}', account_name) ?? '';

  const conn = createConnection({
    provider_id,
    account_name,
    credentials,
    policy_yaml: yaml,
  });

  refreshToolRegistry();
  return c.json(conn, 201);
});

app.delete('/connections/:id', (c) => {
  const id = c.req.param('id');
  const deleted = deleteConnection(id);
  if (!deleted) {
    return c.json({ error: 'Connection not found' }, 404);
  }
  refreshToolRegistry();
  return c.json({ deleted: true });
});

app.get('/connections/:id/settings', (c) => {
  const id = c.req.param('id');
  const conn = getConnection(id);
  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }
  return c.json(getConnectionSettings(id));
});

app.put('/connections/:id/settings', async (c) => {
  const id = c.req.param('id');
  const conn = getConnection(id);
  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  const body = await c.req.json();

  // Validate emailAliasSuffix if present
  if (body.emailAliasSuffix !== undefined) {
    if (typeof body.emailAliasSuffix !== 'string' || !/^\+?[a-zA-Z0-9]*$/.test(body.emailAliasSuffix)) {
      return c.json({ error: 'Invalid emailAliasSuffix: must match /^\\+?[a-zA-Z0-9]*$/' }, 400);
    }
  }

  updateConnectionSettings(id, body);
  return c.json({ updated: true });
});

app.patch('/connections/:id/enabled', async (c) => {
  const id = c.req.param('id');
  const conn = getConnection(id);
  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  const body = await c.req.json();
  if (typeof body.enabled !== 'boolean') {
    return c.json({ error: 'enabled must be a boolean' }, 400);
  }

  toggleConnectionEnabled(id, body.enabled);
  refreshToolRegistry();
  return c.json({ updated: true, enabled: body.enabled });
});

app.get('/connections/oauth/:providerId/start', (c) => {
  const providerId = c.req.param('providerId');
  const provider = getProvider(providerId);

  if (!provider?.oauth) {
    return c.json({ error: 'Unknown provider or provider does not support OAuth' }, 400);
  }

  const clientId = getOAuthClientId(provider);
  const clientSecret = getOAuthClientSecret(provider);
  const usePkce = provider.oauth.pkce === true;

  if (!clientId || (!usePkce && !clientSecret)) {
    return c.json({ error: `OAuth credentials not configured for ${provider.displayName}. Add them in the dashboard settings.` }, 500);
  }

  const redirectUri = `http://localhost:${config.ADMIN_PORT}/api/connections/oauth/callback`;

  // Generate PKCE challenge for public-client providers
  let codeVerifier: string | undefined;
  const extraParams: Record<string, string> = {};
  if (usePkce) {
    const pkce = generatePkce();
    codeVerifier = pkce.codeVerifier;
    extraParams.code_challenge = pkce.codeChallenge;
    extraParams.code_challenge_method = 'S256';
  }

  // Resolve OAuth scopes — use the requested access level's variant if available
  const accessLevel = c.req.query('access');
  const variants = provider.oauth.oauthScopeVariants;
  const scopes = (accessLevel && variants?.[accessLevel]) ?? provider.oauth.scopes;

  // Capture the dashboard origin so the OAuth callback can redirect back to it.
  // In dev mode, the dashboard runs on a different port (Vite dev server) than the
  // admin API, so the callback must redirect to the correct origin.
  const referer = c.req.header('Referer');
  let returnOrigin: string | undefined;
  if (referer) {
    try {
      const parsed = new URL(referer);
      // Only allow localhost origins to prevent open redirect
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]') {
        returnOrigin = parsed.origin;
      }
    } catch { /* ignore invalid */ }
  }

  const state = createOAuthState('session', providerId, codeVerifier, returnOrigin, accessLevel && variants?.[accessLevel] ? accessLevel : undefined);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    ...provider.oauth.extraAuthorizeParams,
    ...extraParams,
  });

  const authUrl = `${provider.oauth.authorizeUrl}?${params.toString()}`;
  return c.redirect(authUrl);
});

app.get('/connections/oauth/callback', async (c) => {
  // Validate CSRF nonce and retrieve provider ID + PKCE verifier before any state changes
  const stateParam = c.req.query('state');
  const oauthState = stateParam ? redeemOAuthState(stateParam) : null;
  if (!oauthState) {
    return c.redirect('/?oauth=error&message=' + encodeURIComponent('Invalid or expired OAuth state. Please try again.'));
  }

  const providerId = oauthState.providerId;
  const provider = getProvider(providerId);

  if (!provider?.oauth) {
    return c.redirect('/?oauth=error&message=' + encodeURIComponent('Invalid OAuth state. Please try again.'));
  }

  // Redirect back to the dashboard origin (may differ from the API server in dev mode)
  const base = oauthState.returnOrigin ?? '';

  const code = c.req.query('code');
  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  const clientId = getOAuthClientId(provider);
  const clientSecret = getOAuthClientSecret(provider);
  const usePkce = provider.oauth.pkce === true;

  if (!clientId || (!usePkce && !clientSecret)) {
    return c.json({ error: `OAuth credentials not configured for ${provider.displayName}` }, 500);
  }

  const redirectUri = `http://localhost:${config.ADMIN_PORT}/api/connections/oauth/callback`;

  // Build token exchange params — PKCE providers use code_verifier, others use client_secret
  const tokenParams: Record<string, string> = {
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };
  if (usePkce) {
    if (!oauthState.codeVerifier) {
      return c.redirect(base + '/?oauth=error&message=' + encodeURIComponent('PKCE verifier missing from OAuth state. Please try again.'));
    }
    tokenParams.code_verifier = oauthState.codeVerifier;
  }
  if (clientSecret) {
    tokenParams.client_secret = clientSecret;
  }

  const tokenRes = await fetch(provider.oauth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenParams),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return c.redirect(base + '/?oauth=error&message=' + encodeURIComponent(`Token exchange failed: ${stripSensitivePatterns(errText)}`));
  }

  const tokens = await tokenRes.json() as Record<string, unknown>;

  if (!tokens.refresh_token) {
    console.warn(`OAuth callback for ${providerId}: no refresh_token returned by provider`);
  }

  // Discover account name
  let accountName = 'unknown';
  try {
    accountName = await provider.oauth.discoverAccount(tokens.access_token as string);
  } catch {
    // Fall back to 'unknown'
  }

  // Normalize credentials — convert expires_in (relative) to expiry_date (absolute)
  const newCredentials: Record<string, unknown> = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type,
  };
  if (typeof tokens.expires_in === 'number') {
    newCredentials.expiry_date = Date.now() + tokens.expires_in * 1000;
  } else if (tokens.expiry_date != null) {
    newCredentials.expiry_date = tokens.expiry_date;
  }

  // Store account_email in credentials for alias suffix logic
  if (providerId === 'google_gmail' || providerId === 'outlook_mail') {
    newCredentials.account_email = accountName;
  }

  const existing = findConnectionByProviderAccount(providerId, accountName);
  let conn;
  if (existing) {
    updateConnectionCredentials(existing.id, newCredentials);
    setConnectionNeedsReauth(existing.id, false);
    // Update stored access level if this re-auth used scope variants
    if (oauthState.accessLevel) {
      updateConnectionSettings(existing.id, { oauthAccessLevel: oauthState.accessLevel });
    }
    conn = existing;
  } else {
    // Pick preset based on access level when scope variants were used,
    // otherwise fall back to the previous setup-based logic
    let policyYaml: string;
    if (oauthState.accessLevel && provider.presets?.[oauthState.accessLevel]) {
      policyYaml = provider.presets[oauthState.accessLevel].replace('{account}', accountName);
    } else {
      const setupCompleted = getSetting('setup_completed') === 'true';
      const readOnlyYaml = provider.presets?.['read-only'];
      policyYaml = (!setupCompleted && readOnlyYaml)
        ? readOnlyYaml.replace('{account}', accountName)
        : provider.defaultPolicyYaml.replace('{account}', accountName);
    }

    conn = createConnection({
      provider_id: providerId,
      account_name: accountName,
      credentials: newCredentials,
      policy_yaml: policyYaml,
    });

    // Set default connection settings for email providers
    const settings: Record<string, unknown> = {};
    if (providerId === 'google_gmail' || providerId === 'outlook_mail') {
      settings.emailAliasSuffix = '+agent';
    }
    if (oauthState.accessLevel) {
      settings.oauthAccessLevel = oauthState.accessLevel;
    }
    if (Object.keys(settings).length > 0) {
      updateConnectionSettings(conn.id, settings);
    }
  }

  refreshToolRegistry();

  return c.redirect(`${base}/?oauth=success&provider=${providerId}`);
});

app.post('/connections/:id/test', async (c) => {
  const id = c.req.param('id');
  const conn = getConnectionWithCredentials(id);
  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  const provider = getProvider(conn.provider_id);
  if (!provider) {
    return c.json({ ok: false, error: `Unknown provider: ${conn.provider_id}` });
  }

  const testOp = TEST_OPERATIONS[conn.provider_id];
  if (!testOp) {
    return c.json({ ok: false, error: `No test operation defined for ${provider.displayName}` });
  }

  let credentials = conn.credentials;
  const settings = getConnectionSettings(conn.id);

  try {
    // If token is expired, try refreshing proactively
    const expiry = credentials.expiry_date;
    if (typeof expiry === 'number' && expiry < Date.now() && provider.refreshCredentials) {
      credentials = await refreshConnectionCredentials(conn.id, provider, credentials);
    }

    const result = await provider.execute(testOp.tool, testOp.params, credentials, undefined, settings);
    return c.json({ ok: true, preview: testPreview(conn.provider_id, result) });
  } catch (err: unknown) {
    if (provider.refreshCredentials && isAuthError(err)) {
      try {
        credentials = await refreshConnectionCredentials(conn.id, provider, credentials);
        const result = await provider.execute(testOp.tool, testOp.params, credentials, undefined, settings);
        return c.json({ ok: true, preview: testPreview(conn.provider_id, result) });
      } catch (refreshErr: unknown) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        return c.json({ ok: false, error: stripSensitivePatterns(msg) });
      }
    }

    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: stripSensitivePatterns(msg) });
  }
});

export default app;
