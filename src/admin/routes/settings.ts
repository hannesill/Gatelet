import { Hono } from 'hono';
import { getGoogleClientId, getGoogleClientSecret, setGoogleCredentials } from '../../db/settings.js';

const app = new Hono();

app.get('/settings/google', (c) => {
  const clientId = getGoogleClientId();
  return c.json({
    configured: !!(clientId && getGoogleClientSecret()),
    client_id: clientId ? clientId.slice(0, 12) + '...' : null,
  });
});

app.put('/settings/google', async (c) => {
  const body = await c.req.json();
  const { client_id, client_secret } = body;

  if (!client_id || !client_secret) {
    return c.json({ error: 'Missing client_id or client_secret' }, 400);
  }

  setGoogleCredentials(client_id, client_secret);
  return c.json({ saved: true });
});

export default app;
