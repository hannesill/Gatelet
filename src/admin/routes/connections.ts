import { Hono } from 'hono';
import {
  listConnections,
  getConnection,
  createConnection,
  deleteConnection,
  findConnectionByProviderAccount,
  updateConnectionCredentials,
  updateConnectionPolicy,
  getConnectionSettings,
  updateConnectionSettings,
} from '../../db/connections.js';
import { getProvider } from '../../providers/registry.js';
import { getOAuthClientId, getOAuthClientSecret } from '../../db/settings.js';
import { config } from '../../config.js';
import { refreshToolRegistry } from '../../mcp/server.js';
import crypto from 'node:crypto';

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

  // Validate CSRF nonce (but we no longer need the token from it)
  const state = c.req.query('state');
  if (state) {
    redeemOAuthNonce(state);
  }

  return c.redirect(`/?oauth=success&provider=${providerId}`);
});

export default app;
