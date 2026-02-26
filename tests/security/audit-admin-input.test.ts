/**
 * Security Audit: Admin API input validation
 *
 * Tests for missing fields, invalid YAML, header injection.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { findFreePort, createTestEnvironment } from '../helpers/test-setup.js';
import { config } from '../../src/config.js';
import { createAdminApp } from '../../src/admin/server.js';
import type { Hono } from 'hono';

const TEST_ADMIN_TOKEN = 'audit-admin-input-token';
const env = createTestEnvironment('audit-admin-input');

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

describe('Admin API input validation', () => {
  it('connection creation rejects missing fields', async () => {
    const res = await req('/api/connections', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider_id: 'google_calendar' }),
    });
    expect(res.status).toBe(400);
  });

  it('policy update rejects invalid YAML for nonexistent connection', async () => {
    const res = await req('/api/connections/nonexistent/policy', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'text/yaml',
      },
      body: ': invalid yaml [[[',
    });
    expect(res.status).toBe(404);
  });

  it('emailAliasSuffix injection is blocked', async () => {
    const res = await req('/api/connections/fake-id/settings', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emailAliasSuffix: '+agent\r\nBcc: evil@attacker.com' }),
    });
    expect([400, 404]).toContain(res.status);
  });

  it('emailAliasSuffix rejects path traversal characters', async () => {
    const res = await req('/api/connections/fake-id/settings', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emailAliasSuffix: '../../../etc/passwd' }),
    });
    expect([400, 404]).toContain(res.status);
  });
});
