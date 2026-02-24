import { Hono } from 'hono';
import { getProvider } from '../../providers/registry.js';

const CONSTRAINT_REFERENCE = [
  { rule: 'must_equal', requiresValue: true },
  { rule: 'must_be_one_of', requiresValue: true },
  { rule: 'must_not_be_empty', requiresValue: false },
];

const MUTATION_REFERENCE = [
  { action: 'set', requiresValue: true },
  { action: 'delete', requiresValue: false },
];

const app = new Hono();

app.get('/providers/:id/reference', (c) => {
  const id = c.req.param('id');
  const provider = getProvider(id);

  if (!provider) {
    return c.json({ error: 'Provider not found' }, 404);
  }

  const operations = provider.tools.map(t => ({
    name: t.name,
    policyOperation: t.policyOperation,
    fields: Object.keys(t.inputSchema),
  }));

  const example = provider.defaultPolicyYaml.replace('{account}', 'user@example.com');

  return c.json({
    provider: { id: provider.id, displayName: provider.displayName },
    operations,
    constraints: CONSTRAINT_REFERENCE,
    mutations: MUTATION_REFERENCE,
    example,
  });
});

export default app;
