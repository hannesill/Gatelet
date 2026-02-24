import { Hono } from 'hono';
import { runDoctor } from '../../doctor/index.js';

const app = new Hono();

app.get('/doctor', async (c) => {
  const results = await runDoctor({ fix: false });
  return c.json(results.map(r => ({
    id: r.check.id,
    name: r.check.name,
    status: r.status,
    message: r.message,
    fixable: r.check.fixable,
    fixed: r.fixed ?? false,
  })));
});

app.post('/doctor/fix', async (c) => {
  const results = await runDoctor({ fix: true });
  return c.json(results.map(r => ({
    id: r.check.id,
    name: r.check.name,
    status: r.status,
    message: r.message,
    fixable: r.check.fixable,
    fixed: r.fixed ?? false,
  })));
});

export default app;
