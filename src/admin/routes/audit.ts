import { Hono } from 'hono';
import { queryAuditLog, countAuditLog } from '../../db/audit.js';

const app = new Hono();

app.get('/audit', (c) => {
  const filters = {
    limit: Number(c.req.query('limit')) || 50,
    offset: Number(c.req.query('offset')) || 0,
    tool_name: c.req.query('tool_name'),
    result: c.req.query('result'),
    from: c.req.query('from'),
    to: c.req.query('to'),
  };
  const entries = queryAuditLog(filters);
  const total = countAuditLog(filters);
  return c.json({ entries, total });
});

export default app;
