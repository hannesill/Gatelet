import { Hono } from 'hono';
import {
  getConnection,
  updateConnectionPolicy,
} from '../../db/connections.js';
import { parsePolicy } from '../../policy/parser.js';
import { getProvider } from '../../providers/registry.js';
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

  let warnings: string[];
  try {
    const result = parsePolicy(body);
    warnings = result.warnings;
  } catch (e) {
    return c.json({ error: `Invalid policy YAML: ${(e as Error).message}` }, 400);
  }

  updateConnectionPolicy(id, body);
  refreshToolRegistry();

  return c.json({ updated: true, warnings });
});

app.post('/connections/:id/policy/validate', async (c) => {
  const id = c.req.param('id');
  const conn = getConnection(id);
  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  const body = await c.req.text();

  try {
    const { policy, warnings } = parsePolicy(body);
    const provider = getProvider(conn.provider_id);
    const tools = provider
      ? provider.tools.map(t => ({
          name: t.name,
          operation: t.policyOperation,
          enabled: !!policy.operations[t.policyOperation]?.allow,
        }))
      : [];

    return c.json({ valid: true, tools, warnings });
  } catch (e) {
    return c.json({ valid: false, error: (e as Error).message });
  }
});

export default app;
