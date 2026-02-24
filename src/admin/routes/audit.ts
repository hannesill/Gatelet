import { Hono } from 'hono';
import { queryAuditLog } from '../../db/audit.js';

const app = new Hono();

app.get('/audit', (c) => {
  const entries = queryAuditLog({
    limit: Number(c.req.query('limit')) || 50,
    offset: Number(c.req.query('offset')) || 0,
    tool_name: c.req.query('tool_name'),
    result: c.req.query('result'),
    from: c.req.query('from'),
    to: c.req.query('to'),
  });
  return c.json(entries);
});

export default app;
