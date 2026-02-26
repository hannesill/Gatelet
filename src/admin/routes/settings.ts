import { Hono } from 'hono';
import { getOAuthClientId, getOAuthClientSecret, setOAuthCredentials } from '../../db/settings.js';
import { getProvider } from '../../providers/registry.js';

const app = new Hono();

app.get('/settings/oauth/:providerId', (c) => {
  const providerId = c.req.param('providerId');
  const provider = getProvider(providerId);

  if (!provider?.oauth) {
    return c.json({ error: 'Unknown provider or provider does not support OAuth' }, 400);
  }

  const clientId = getOAuthClientId(provider);
  const clientSecret = getOAuthClientSecret(provider);
  const secretOptional = provider.oauth.pkce === true;
  return c.json({
    configured: !!(clientId && (secretOptional || clientSecret)),
    client_id: clientId ? clientId.slice(0, 12) + '...' : null,
  });
});

app.put('/settings/oauth/:providerId', async (c) => {
  const providerId = c.req.param('providerId');
  const provider = getProvider(providerId);

  if (!provider?.oauth) {
    return c.json({ error: 'Unknown provider or provider does not support OAuth' }, 400);
  }

  const body = await c.req.json();
  const { client_id, client_secret } = body;

  if (!client_id || !client_secret) {
    return c.json({ error: 'Missing client_id or client_secret' }, 400);
  }

  setOAuthCredentials(provider.oauth.settingsKeyPrefix, client_id, client_secret);
  return c.json({ saved: true });
});

export default app;
