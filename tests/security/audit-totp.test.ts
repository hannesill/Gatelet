/**
 * Security Audit: TOTP 2FA bypass vectors
 *
 * Tests for pendingSecret race condition, session invalidation,
 * and Bearer+2FA enforcement.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TOTP, Secret } from 'otpauth';
import { findFreePort, createTestEnvironment } from '../helpers/test-setup.js';
import { config } from '../../src/config.js';
import { createAdminApp } from '../../src/admin/server.js';
import { deleteSetting } from '../../src/db/settings.js';
import { resetPendingSecret } from '../../src/admin/routes/totp.js';
import type { Hono } from 'hono';

const TEST_ADMIN_TOKEN = 'audit-totp-admin-token';
const env = createTestEnvironment('audit-totp');

const [mcpPort, adminPort] = await Promise.all([findFreePort(), findFreePort()]);
process.env.GATELET_DATA_DIR = env.dataDir;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(mcpPort);
process.env.GATELET_ADMIN_PORT = String(adminPort);

let app: Hono;

function req(urlPath: string, init?: RequestInit) {
  return app.request(urlPath, init);
}

async function getSessionCookie(): Promise<string> {
  const res = await req('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TEST_ADMIN_TOKEN }),
  });
  const setCookie = res.headers.get('Set-Cookie') ?? '';
  const match = setCookie.match(/gatelet_session=([^;]+)/);
  return match ? `gatelet_session=${match[1]}` : '';
}

beforeAll(() => {
  env.setup();
  config.ADMIN_TOKEN = TEST_ADMIN_TOKEN;
  app = createAdminApp();
});

afterAll(() => {
  env.teardown();
});

describe('TOTP 2FA bypass vectors', () => {
  beforeEach(() => {
    try {
      deleteSetting('totp_secret');
      deleteSetting('totp_enabled');
      deleteSetting('totp_backup_codes');
    } catch { /* ignore */ }
    resetPendingSecret();
  });

  // FINDING-NEW-07: pendingSecret is shared across sessions
  it('FINDING-NEW-07: pendingSecret is shared across sessions (race condition)', async () => {
    const cookie1 = await getSessionCookie();
    const cookie2 = await getSessionCookie();

    const setup1Res = await req('/api/totp/setup', {
      method: 'POST',
      headers: { Cookie: cookie1, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { secret: secret1 } = await setup1Res.json();

    const setup2Res = await req('/api/totp/setup', {
      method: 'POST',
      headers: { Cookie: cookie2, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { secret: secret2 } = await setup2Res.json();

    expect(secret1).not.toBe(secret2);

    const totp1 = new TOTP({
      issuer: 'Gatelet',
      label: 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret1),
    });

    const verify1Res = await req('/api/totp/verify-setup', {
      method: 'POST',
      headers: { Cookie: cookie1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totp1.generate() }),
    });

    // Session 1's verify fails because pendingSecret was overwritten by session 2
    expect(verify1Res.status).toBe(400);
  });

  // FINDING-NEW-08: existing sessions invalidated when 2FA enabled
  it('FINDING-NEW-08 FIXED: existing session cookies are invalidated when 2FA is enabled', async () => {
    const cookieBefore = await getSessionCookie();

    const setupRes = await req('/api/totp/setup', {
      method: 'POST',
      headers: { Cookie: cookieBefore, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { secret } = await setupRes.json();

    const totp = new TOTP({
      issuer: 'Gatelet',
      label: 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });

    await req('/api/totp/verify-setup', {
      method: 'POST',
      headers: { Cookie: cookieBefore, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totp.generate() }),
    });

    const apiRes = await req('/api/api-keys', {
      headers: { Cookie: cookieBefore },
    });
    expect(apiRes.status).toBe(401);
  });

  // FINDING-NEW-09: Bearer auth requires X-TOTP-Code when 2FA enabled
  it('FINDING-NEW-09 FIXED: Bearer admin token requires X-TOTP-Code when 2FA is enabled', async () => {
    const cookie = await getSessionCookie();
    const setupRes = await req('/api/totp/setup', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { secret } = await setupRes.json();

    const totp = new TOTP({
      issuer: 'Gatelet',
      label: 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });

    await req('/api/totp/verify-setup', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totp.generate() }),
    });

    const apiResNoTotp = await req('/api/api-keys', {
      headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
    });
    expect(apiResNoTotp.status).toBe(401);

    const apiResWithTotp = await req('/api/api-keys', {
      headers: {
        Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
        'X-TOTP-Code': totp.generate(),
      },
    });
    expect(apiResWithTotp.status).toBe(200);
  });
});
