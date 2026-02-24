import { Hono } from 'hono';
import {
  getConnection,
  updateConnectionPolicy,
} from '../../db/connections.js';
import { parsePolicy } from '../../policy/parser.js';
import { refreshToolRegistry } from '../../mcp/server.js';

const app = new Hono();

app.get('/connections/:id/policy', (c) => {
  const id = c.req.param('id');
  const conn = getConnection(id);
  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }
  return c.text(conn.policy_yaml, 200, { 'Content-Type': 'text/yaml' });
});

app.put('/connections/:id/policy', async (c) => {
  const id = c.req.param('id');
  const conn = getConnection(id);
  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  const body = await c.req.text();

  try {
    parsePolicy(body);
  } catch (e) {
    return c.json({ error: `Invalid policy YAML: ${(e as Error).message}` }, 400);
  }

  updateConnectionPolicy(id, body);
  refreshToolRegistry();

  return c.json({ updated: true });
});

export default app;
