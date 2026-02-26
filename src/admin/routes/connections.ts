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
} from '../../db/connections.js';
import { getProvider } from '../../providers/registry.js';
import { getOAuthClientId, getOAuthClientSecret } from '../../db/settings.js';
import { config } from '../../config.js';
import { refreshToolRegistry } from '../../mcp/server.js';
import crypto from 'node:crypto';

/** Maps provider ID to the safe read-only tool name and params used for testing. */
const TEST_OPERATIONS: Record<string, { tool: string; params: Record<string, unknown> }> = {
  google_gmail: { tool: 'gmail_search', params: { maxResults: 1 } },
  google_calendar: { tool: 'calendar_list_calendars', params: {} },
  outlook_calendar: { tool: 'outlook_list_calendars', params: {} },
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
    return 'Connection verified';
  } catch {
    return 'Connection verified';
  }
}

// OAuth CSRF nonce store — maps nonce -> admin token, auto-expires after 10 minutes
const oauthNonces = new Map<string, { token: string; expires: number }>();

function createOAuthNonce(adminToken: string): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  oauthNonces.set(nonce, { token: adminToken, expires: Date.now() + 10 * 60 * 1000 });
  // Clean up expired nonces
  for (const [key, value] of oauthNonces) {
    if (value.expires < Date.now()) oauthNonces.delete(key);
  }
  return nonce;
}

function redeemOAuthNonce(nonce: string): string | null {
  const entry = oauthNonces.get(nonce);
  if (!entry || entry.expires < Date.now()) {
    oauthNonces.delete(nonce);
    return null;
  }
  oauthNonces.delete(nonce);
  return entry.token;
}

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

  if (!clientId || !clientSecret) {
    return c.json({ error: `OAuth credentials not configured for ${provider.displayName}. Add them in the dashboard settings.` }, 500);
  }

  const redirectUri = `http://localhost:${config.ADMIN_PORT}/api/connections/oauth/${providerId}/callback`;
  const nonce = createOAuthNonce('session');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.oauth.scopes.join(' '),
    state: nonce,
    ...provider.oauth.extraAuthorizeParams,
  });

  const authUrl = `${provider.oauth.authorizeUrl}?${params.toString()}`;
  return c.redirect(authUrl);
});

app.get('/connections/oauth/:providerId/callback', async (c) => {
  const providerId = c.req.param('providerId');
  const provider = getProvider(providerId);

  if (!provider?.oauth) {
    return c.json({ error: 'Unknown provider or provider does not support OAuth' }, 400);
  }

  // Validate CSRF nonce before any state changes
  const state = c.req.query('state');
  if (!state || !redeemOAuthNonce(state)) {
    return c.redirect('/?oauth=error&message=' + encodeURIComponent('Invalid or expired OAuth state. Please try again.'));
  }

  const code = c.req.query('code');
  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  const clientId = getOAuthClientId(provider);
  const clientSecret = getOAuthClientSecret(provider);

  if (!clientId || !clientSecret) {
    return c.json({ error: `OAuth credentials not configured for ${provider.displayName}` }, 500);
  }

  const redirectUri = `http://localhost:${config.ADMIN_PORT}/api/connections/oauth/${providerId}/callback`;

  // Standard OAuth2 token exchange
  const tokenRes = await fetch(provider.oauth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return c.redirect('/?oauth=error&message=' + encodeURIComponent(`Token exchange failed: ${errText}`));
  }

  const tokens = await tokenRes.json() as Record<string, unknown>;

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
  if (providerId === 'google_gmail') {
    newCredentials.account_email = accountName;
  }

  const existing = findConnectionByProviderAccount(providerId, accountName);
  let conn;
  if (existing) {
    updateConnectionCredentials(existing.id, newCredentials);
    conn = existing;
  } else {
    conn = createConnection({
      provider_id: providerId,
      account_name: accountName,
      credentials: newCredentials,
      policy_yaml: provider.defaultPolicyYaml.replace('{account}', accountName),
    });

    // Set default connection settings for Gmail
    if (providerId === 'google_gmail') {
      updateConnectionSettings(conn.id, { emailAliasSuffix: '+agent' });
    }
  }

  refreshToolRegistry();

  return c.redirect(`/?oauth=success&provider=${providerId}`);
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
  const settings = JSON.parse(conn.settings_json || '{}');

  try {
    // If token is expired, try refreshing first
    const expiry = credentials.expiry_date;
    if (typeof expiry === 'number' && expiry < Date.now() && provider.refreshCredentials) {
      const clientId = getOAuthClientId(provider);
      const clientSecret = getOAuthClientSecret(provider);
      credentials = await provider.refreshCredentials(credentials, {
        clientId: clientId ?? '',
        clientSecret: clientSecret ?? '',
      });
      updateConnectionCredentials(conn.id, credentials);
    }

    const result = await provider.execute(testOp.tool, testOp.params, credentials, undefined, settings);
    return c.json({ ok: true, preview: testPreview(conn.provider_id, result) });
  } catch (err: unknown) {
    // Try refresh on auth errors
    if (
      provider.refreshCredentials &&
      err instanceof Error &&
      (err.message.includes('invalid_grant') ||
        err.message.includes('Token has been expired') ||
        err.message.includes('401'))
    ) {
      try {
        const clientId = getOAuthClientId(provider);
        const clientSecret = getOAuthClientSecret(provider);
        credentials = await provider.refreshCredentials(credentials, {
          clientId: clientId ?? '',
          clientSecret: clientSecret ?? '',
        });
        updateConnectionCredentials(conn.id, credentials);

        const result = await provider.execute(testOp.tool, testOp.params, credentials, undefined, settings);
        return c.json({ ok: true, preview: testPreview(conn.provider_id, result) });
      } catch (refreshErr: unknown) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        return c.json({ ok: false, error: msg });
      }
    }

    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: msg });
  }
});

export default app;
