import { Hono } from 'hono';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from '../../db/api-keys.js';

const app = new Hono();

app.get('/api-keys', (c) => {
  const keys = listApiKeys();
  return c.json(keys);
});

app.post('/api-keys', async (c) => {
  const body = await c.req.json();
  const { name } = body;
  if (!name) {
    return c.json({ error: 'Missing required field: name' }, 400);
  }

  const result = createApiKey(name);
  return c.json(result, 201);
});

app.delete('/api-keys/:id', (c) => {
  const id = c.req.param('id');
  const revoked = revokeApiKey(id);
  if (!revoked) {
    return c.json({ error: 'API key not found or already revoked' }, 404);
  }
  return c.json({ revoked: true });
});

export default app;
