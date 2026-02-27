/**
 * Security Audit: OAuth CSRF state validation + credential exposure
 *
 * FINDING-NEW-10/11 (code review, no test): Admin sessions have no count limit.
 * Unlike MCP sessions (MAX_SESSIONS = 100), the admin session Map grows without bound.
 * Sessions are not bound to client identity — no IP or user-agent binding.
 *
 * FINDING-NEW-13 (code review, no test): Builtin OAuth client secrets are
 * hardcoded in provider source. Shared across all installations.
 *
 * FINDING-NEW-14 (code review, no test): Admin token is logged to stdout on startup.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { findFreePort, createTestEnvironment } from '../helpers/test-setup.js';
import { config } from '../../src/config.js';
import { createAdminApp } from '../../src/admin/server.js';
import type { Hono } from 'hono';

const TEST_ADMIN_TOKEN = 'audit-oauth-admin-token';
const env = createTestEnvironment('audit-oauth');

const [mcpPort, adminPort] = await Promise.all([findFreePort(), findFreePort()]);
process.env.GATELET_DATA_DIR = env.dataDir;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(mcpPort);
process.env.GATELET_ADMIN_PORT = String(adminPort);

let app: Hono;

function req(urlPath: string, init?: RequestInit) {
  return app.request(urlPath, init);
}

beforeAll(() => {
  env.setup();
  config.ADMIN_TOKEN = TEST_ADMIN_TOKEN;
  app = createAdminApp();
});

afterAll(() => {
  env.teardown();
});

describe('OAuth flow CSRF and state validation', () => {
  // FINDING-NEW-12: OAuth callback does not validate state nonce
  it('FINDING-NEW-12: OAuth callback ignores invalid/missing state', async () => {
    const res = await req(
      '/api/connections/oauth/callback?code=fake_code&state=completely_fake',
    );
    expect(res.status).not.toBe(403);
  });

  it('FINDING-NEW-12: OAuth callback works without state parameter', async () => {
    const res = await req(
      '/api/connections/oauth/callback?code=fake_code',
    );
    expect(res.status).not.toBe(403);
  });
});

describe('Credential exposure prevention', () => {
  it('OAuth error from token exchange may leak client_secret in redirect', async () => {
    const res = await req(
      '/api/connections/oauth/callback?code=invalid_code&state=test',
    );
    if (res.status === 302) {
      const location = res.headers.get('Location') ?? '';
      expect(location).not.toContain('GOCSPX');
    }
  });
});
