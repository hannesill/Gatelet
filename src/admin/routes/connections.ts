import { Hono } from 'hono';
import { google } from 'googleapis';
import {
  listConnections,
  createConnection,
  deleteConnection,
} from '../../db/connections.js';
import { getProvider } from '../../providers/registry.js';
import { getGoogleClientId, getGoogleClientSecret } from '../../db/settings.js';
import { config } from '../../config.js';
import { refreshToolRegistry } from '../../mcp/server.js';

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

app.get('/connections/oauth/google/start', (c) => {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    return c.json({ error: 'Google OAuth credentials not configured. Add them in the dashboard settings.' }, 500);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    config.GOOGLE_REDIRECT_URI,
  );

  const token = c.req.query('token') || '';

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state: token,
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });

  return c.redirect(authUrl);
});

app.get('/connections/oauth/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    return c.json({ error: 'Google OAuth credentials not configured' }, 500);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    config.GOOGLE_REDIRECT_URI,
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  let accountName = 'unknown';
  try {
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendarApi.calendarList.list();
    const primary = calendarList.data.items?.find((cal) => cal.primary);
    if (primary?.id) {
      accountName = primary.id;
    }
  } catch {
    // Fall back to 'unknown' if we can't fetch the account name
  }

  const provider = getProvider('google_calendar')!;
  const conn = createConnection({
    provider_id: 'google_calendar',
    account_name: accountName,
    credentials: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type,
    },
    policy_yaml: provider.defaultPolicyYaml.replace('{account}', accountName),
  });

  refreshToolRegistry();

  const state = c.req.query('state');
  if (state) {
    return c.redirect(`/?token=${state}`);
  }

  return c.json({
    connection_id: conn.id,
    account_name: accountName,
    message: 'Connected',
  });
});

export default app;
