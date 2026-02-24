import { Hono } from 'hono';
import { getProvider } from '../../providers/registry.js';

const CONSTRAINT_REFERENCE = [
  { rule: 'must_equal', description: 'Field must exactly equal the given value', requiresValue: true },
  { rule: 'must_be_one_of', description: 'Field must be one of the values in the array', requiresValue: true },
  { rule: 'must_not_be_empty', description: 'Field must not be empty, null, or undefined', requiresValue: false },
];

const MUTATION_REFERENCE = [
  { action: 'set', description: 'Set the field to the given value', requiresValue: true },
  { action: 'delete', description: 'Remove the field from the parameters', requiresValue: false },
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
    description: t.description,
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
