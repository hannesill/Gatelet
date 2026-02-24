import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import connectionsRoutes from './routes/connections.js';
import policiesRoutes from './routes/policies.js';
import apiKeysRoutes from './routes/api-keys.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import { config } from '../config.js';
import { listConnections } from '../db/connections.js';
import { listApiKeys } from '../db/api-keys.js';
import { queryAuditLog, countAuditLog } from '../db/audit.js';
import { getRegisteredToolCount } from '../mcp/server.js';
import { adminPage } from './page.js';

export function createAdminApp(): Hono {
  const app = new Hono();

  // Admin token auth middleware for API routes
  app.use('/api/*', async (c, next) => {
    // OAuth callback is unauthenticated (Google redirects here)
    if (c.req.path === '/api/connections/oauth/google/callback') {
      return next();
    }

    // Allow OAuth start from the dashboard via query param
    if (c.req.path === '/api/connections/oauth/google/start' && c.req.query('token')) {
      const token = c.req.query('token');
      if (token === config.ADMIN_TOKEN) {
        return next();
      }
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || match[1] !== config.ADMIN_TOKEN) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  });

  // Dashboard — login with admin token, then manage everything
  app.get('/', (c) => {
    const token = c.req.query('token');
    if (token !== config.ADMIN_TOKEN) {
      return c.html(adminPage('login', { error: undefined }));
    }

    const connections = listConnections();
    const apiKeys = listApiKeys();
    const toolCount = getRegisteredToolCount();

    const auditOffset = Number(c.req.query('audit_offset')) || 0;
    const auditEntries = queryAuditLog({ limit: 25, offset: auditOffset });
    const auditTotal = countAuditLog();

    return c.html(adminPage('dashboard', {
      token: token!,
      connections,
      apiKeys,
      toolCount,
      auditEntries,
      auditOffset,
      auditTotal,
    }));
  });

  // Health
  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      connections: listConnections().length,
      tools: getRegisteredToolCount(),
    });
  });

  // Routes
  app.route('/api', connectionsRoutes);
  app.route('/api', policiesRoutes);
  app.route('/api', apiKeysRoutes);
  app.route('/api', auditRoutes);
  app.route('/api', settingsRoutes);

  return app;
}

export function startAdminServer(): void {
  const app = createAdminApp();

  serve({ fetch: app.fetch, port: config.ADMIN_PORT }, () => {
    console.log(`Admin server listening on :${config.ADMIN_PORT}`);
  });
}
