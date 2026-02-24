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
import { getAllProviders } from '../providers/registry.js';
import { getOAuthClientId, getOAuthClientSecret } from '../db/settings.js';
import { adminPage } from './page.js';
import { createRateLimiter } from '../rate-limit.js';

const adminLimiter = createRateLimiter(10, 60 * 1000); // 10 failures per minute

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function createAdminApp(): Hono {
  const app = new Hono();

  // Admin token auth middleware for API routes
  app.use('/api/*', async (c, next) => {
    // OAuth callbacks are unauthenticated (provider redirects here)
    if (/^\/api\/connections\/oauth\/[^/]+\/callback$/.test(c.req.path)) {
      return next();
    }

    const clientIp = getClientIp(c);
    if (adminLimiter.isLimited(clientIp)) {
      return c.json({ error: 'Too many failed attempts. Try again later.' }, 429);
    }

    // Allow OAuth start from the dashboard via query param
    if (/^\/api\/connections\/oauth\/[^/]+\/start$/.test(c.req.path) && c.req.query('token')) {
      const token = c.req.query('token');
      if (token === config.ADMIN_TOKEN) {
        adminLimiter.clear(clientIp);
        return next();
      }
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      adminLimiter.recordFailure(clientIp);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || match[1] !== config.ADMIN_TOKEN) {
      adminLimiter.recordFailure(clientIp);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    adminLimiter.clear(clientIp);
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

    const oauthProviders = getAllProviders()
      .filter(p => p.oauth)
      .map(p => ({
        id: p.id,
        displayName: p.displayName,
        configured: !!(getOAuthClientId(p) && getOAuthClientSecret(p)),
        hasBuiltinCreds: !!(p.oauth!.builtinClientId && p.oauth!.builtinClientSecret),
      }));

    return c.html(adminPage('dashboard', {
      token: token!,
      connections,
      apiKeys,
      toolCount,
      auditEntries,
      auditOffset,
      auditTotal,
      oauthProviders,
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

  serve({ fetch: app.fetch, port: config.ADMIN_PORT, hostname: '127.0.0.1' }, () => {
    console.log(`Admin server listening on 127.0.0.1:${config.ADMIN_PORT}`);
  });
}
