import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import connectionsRoutes from './routes/connections.js';
import policiesRoutes from './routes/policies.js';
import apiKeysRoutes from './routes/api-keys.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import statusRoutes from './routes/status.js';
import providersRoutes from './routes/providers.js';
import doctorRoutes from './routes/doctor.js';
import totpRoutes from './routes/totp.js';
import { config } from '../config.js';
import { createRateLimiter } from '../rate-limit.js';
import { createSession, validateSession, deleteSession } from './session.js';
import { verifyTotpCode, verifyBackupCode } from './totp.js';
import { getSetting, setSetting } from '../db/settings.js';

const adminLimiter = createRateLimiter(10, 60 * 1000); // 10 failures per minute

/** Constant-time string comparison to prevent timing attacks on token verification. */
function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getClientIp(c: { env?: Record<string, unknown>; req: { header: (name: string) => string | undefined } }): string {
  // Only trust X-Forwarded-For when explicitly opted in (e.g., behind a reverse proxy).
  // Default to the socket address to prevent rate-limiter bypass via header spoofing.
  if (process.env.GATELET_TRUST_PROXY) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  // c.env.incoming is the Node.js IncomingMessage when running under @hono/node-server
  const incoming = c.env?.incoming as { socket?: { remoteAddress?: string } } | undefined;
  return incoming?.socket?.remoteAddress || 'unknown';
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  }
  return cookies;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(__dirname, 'dashboard');
const hasSpa = fs.existsSync(path.join(dashboardDir, 'index.html'));

export function createAdminApp(): Hono {
  const app = new Hono();

  // Login endpoint — unauthenticated
  app.post('/api/login', async (c) => {
    const clientIp = getClientIp(c);
    if (adminLimiter.isLimited(clientIp)) {
      return c.json({ error: 'Too many failed attempts. Try again later.' }, 429);
    }

    const body = await c.req.json();
    const { token, totpCode } = body;

    if (!token || typeof token !== 'string' || !config.ADMIN_TOKEN || !safeTokenCompare(token, config.ADMIN_TOKEN)) {
      adminLimiter.recordFailure(clientIp);
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Check if 2FA is enabled
    let totpEnabled = false;
    try {
      totpEnabled = getSetting('totp_enabled') === 'true';
    } catch {
      // Settings table may not be accessible yet — treat as 2FA disabled
    }

    if (totpEnabled) {
      if (!totpCode) {
        // Token is valid but 2FA is required — tell the client
        return c.json({ requires2FA: true });
      }

      const secret = getSetting('totp_secret');
      if (!secret) {
        return c.json({ error: 'TOTP configuration error' }, 500);
      }

      // Try TOTP code first
      let codeValid = verifyTotpCode(secret, totpCode);
      if (!codeValid) {
        // Try backup code
        const hashes = JSON.parse(getSetting('totp_backup_codes') || '[]');
        const result = verifyBackupCode(totpCode, hashes);
        codeValid = result.valid;
        if (result.valid) {
          setSetting('totp_backup_codes', JSON.stringify(result.remainingHashes));
        }
      }

      if (!codeValid) {
        adminLimiter.recordFailure(clientIp);
        return c.json({ error: 'Invalid 2FA code' }, 401);
      }
    }

    adminLimiter.clear(clientIp);
    const sessionId = createSession();

    c.header('Set-Cookie', `gatelet_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
    return c.json({ ok: true });
  });

  // Logout endpoint — uses session cookie
  app.post('/api/logout', (c) => {
    const cookies = parseCookies(c.req.header('Cookie'));
    const sessionId = cookies['gatelet_session'];
    if (sessionId) {
      deleteSession(sessionId);
    }
    c.header('Set-Cookie', 'gatelet_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return c.json({ ok: true });
  });

  // Admin token auth middleware for API routes
  app.use('/api/*', async (c, next) => {
    // Login, logout, and health are unauthenticated
    if (c.req.path === '/api/login' || c.req.path === '/api/logout' || c.req.path === '/api/health') {
      return next();
    }

    // OAuth callbacks are unauthenticated (provider redirects here)
    if (/^\/api\/connections\/oauth\/[^/]+\/callback$/.test(c.req.path)) {
      return next();
    }

    const clientIp = getClientIp(c);
    if (adminLimiter.isLimited(clientIp)) {
      return c.json({ error: 'Too many failed attempts. Try again later.' }, 429);
    }

    // Check session cookie first (for browser sessions)
    const cookies = parseCookies(c.req.header('Cookie'));
    const sessionId = cookies['gatelet_session'];
    if (sessionId && validateSession(sessionId)) {
      adminLimiter.clear(clientIp);
      return next();
    }

    // Check bearer token (for API clients/scripts)
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && config.ADMIN_TOKEN && safeTokenCompare(match[1], config.ADMIN_TOKEN)) {
        // If 2FA is enabled, require X-TOTP-Code header for Bearer auth
        let totpEnabled = false;
        try {
          totpEnabled = getSetting('totp_enabled') === 'true';
        } catch {
          // Settings table may not be accessible yet
        }
        if (totpEnabled) {
          const totpCode = c.req.header('X-TOTP-Code');
          if (!totpCode) {
            return c.json({ error: '2FA required. Provide X-TOTP-Code header.' }, 401);
          }
          const secret = getSetting('totp_secret');
          if (!secret) {
            return c.json({ error: 'TOTP configuration error' }, 500);
          }
          let codeValid = verifyTotpCode(secret, totpCode);
          if (!codeValid) {
            const hashes = JSON.parse(getSetting('totp_backup_codes') || '[]');
            const result = verifyBackupCode(totpCode, hashes);
            codeValid = result.valid;
            if (result.valid) {
              setSetting('totp_backup_codes', JSON.stringify(result.remainingHashes));
            }
          }
          if (!codeValid) {
            adminLimiter.recordFailure(clientIp);
            return c.json({ error: 'Invalid 2FA code' }, 401);
          }
        }
        adminLimiter.clear(clientIp);
        return next();
      }
      // Wrong bearer token — count as an attack attempt
      adminLimiter.recordFailure(clientIp);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Allow OAuth start with token query param for backward compatibility
    if (/^\/api\/connections\/oauth\/[^/]+\/start$/.test(c.req.path)) {
      const token = c.req.query('token');
      if (token && config.ADMIN_TOKEN && safeTokenCompare(token, config.ADMIN_TOKEN)) {
        adminLimiter.clear(clientIp);
        return next();
      }
    }

    // No credentials at all — just not authenticated (don't count against rate limiter)
    return c.json({ error: 'Unauthorized' }, 401);
  });

  // Health (public)
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok' });
  });

  // Routes
  app.route('/api', connectionsRoutes);
  app.route('/api', policiesRoutes);
  app.route('/api', apiKeysRoutes);
  app.route('/api', auditRoutes);
  app.route('/api', settingsRoutes);
  app.route('/api', statusRoutes);
  app.route('/api', providersRoutes);
  app.route('/api', doctorRoutes);
  app.route('/api', totpRoutes);
  // SPA static file serving (only if dist/dashboard exists)
  if (hasSpa) {
    app.use('/assets/*', serveStatic({ root: dashboardDir }));
    app.get('*', serveStatic({ root: dashboardDir, path: 'index.html' }));
  }

  return app;
}

export function startAdminServer(): ReturnType<typeof serve> {
  const app = createAdminApp();

  // In Docker, bind to 0.0.0.0 — NOT 127.0.0.1. Docker port forwarding connects
  // to the container's network interface, not its loopback. Binding to 127.0.0.1
  // inside a container makes the port unreachable from the host, even with
  // -p 127.0.0.1:4001:4001. Host-level restriction is handled by the compose
  // port mapping, not the app bind address.
  const hostname = process.env.GATELET_DATA_DIR === '/data' ? '0.0.0.0' : '127.0.0.1';
  const server = serve({ fetch: app.fetch, port: config.ADMIN_PORT, hostname }, () => {
    console.log(`Admin server listening on ${hostname}:${config.ADMIN_PORT}`);
  });
  return server;
}
