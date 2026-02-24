import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Set up test environment before any imports that use config
const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-admin-test-${Date.now()}`);
const TEST_ADMIN_TOKEN = 'test-admin-token-456';
const TEST_MCP_PORT = 15000;
const TEST_ADMIN_PORT = 15001;

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(TEST_MCP_PORT);
process.env.GATELET_ADMIN_PORT = String(TEST_ADMIN_PORT);

// Now import modules that use config
import { config } from '../../src/config.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { getMasterKey, resetMasterKey } from '../../src/db/crypto.js';
import { createAdminApp } from '../../src/admin/server.js';
import { insertAuditEntry } from '../../src/db/audit.js';
import type { Hono } from 'hono';

const MOCK_POLICY = `provider: google_calendar
account: test@gmail.com

operations:
  list_calendars:
    allow: true
  list_events:
    allow: true
  create_event:
    allow: true
    constraints:
      - field: calendarId
        rule: must_equal
        value: "primary"
`;

let app: Hono;

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

describe('Admin API Routes', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    resetMasterKey();
    resetDb();
    getMasterKey();
    getDb();
    // Ensure config has the right token (may have been set by another test's module init)
    config.ADMIN_TOKEN = TEST_ADMIN_TOKEN;
    app = createAdminApp();
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  // ── Auth ────────────────────────────────────────────────────────────

  describe('Auth', () => {
    it('returns 401 for API routes without token', async () => {
      const res = await req('/api/api-keys');
      expect(res.status).toBe(401);
    });

    it('returns 401 for API routes with wrong token', async () => {
      const res = await req('/api/api-keys', {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 200 for health endpoint with valid token', async () => {
      const res = await req('/api/health', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
    });
  });

  // ── Session Auth ───────────────────────────────────────────────────

  describe('Session Auth', () => {
    it('POST /api/login sets session cookie', async () => {
      const res = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_ADMIN_TOKEN }),
      });
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).toContain('gatelet_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
    });

    it('POST /api/login rejects wrong token', async () => {
      const res = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'wrong-token' }),
      });
      expect(res.status).toBe(401);
    });

    it('session cookie authenticates API requests', async () => {
      // Login to get session cookie
      const loginRes = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_ADMIN_TOKEN }),
      });
      const setCookie = loginRes.headers.get('Set-Cookie') ?? '';
      const sessionId = setCookie.match(/gatelet_session=([^;]+)/)?.[1];
      expect(sessionId).toBeTruthy();

      // Use session cookie for API request (no Bearer token)
      const res = await req('/api/api-keys', {
        headers: { Cookie: `gatelet_session=${sessionId}` },
      });
      expect(res.status).toBe(200);
    });

    it('POST /api/logout clears session', async () => {
      // Login
      const loginRes = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_ADMIN_TOKEN }),
      });
      const setCookie = loginRes.headers.get('Set-Cookie') ?? '';
      const sessionId = setCookie.match(/gatelet_session=([^;]+)/)?.[1];

      // Logout
      const logoutRes = await req('/api/logout', {
        method: 'POST',
        headers: { Cookie: `gatelet_session=${sessionId}` },
      });
      expect(logoutRes.status).toBe(200);
      const clearCookie = logoutRes.headers.get('Set-Cookie') ?? '';
      expect(clearCookie).toContain('Max-Age=0');

      // Session should no longer work
      const res = await req('/api/api-keys', {
        headers: { Cookie: `gatelet_session=${sessionId}` },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── API Keys ────────────────────────────────────────────────────────

  describe('API Keys', () => {
    let createdKeyId: string;
    let createdRawKey: string;

    it('POST /api/api-keys creates a key and returns raw key', async () => {
      const res = await req('/api/api-keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: 'Test Agent Key' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toMatch(/^gl_/);
      expect(body.key).toMatch(/^glk_/);
      createdKeyId = body.id;
      createdRawKey = body.key;
    });

    it('GET /api/api-keys lists keys without raw key', async () => {
      const res = await req('/api/api-keys', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const keys = await res.json();
      expect(Array.isArray(keys)).toBe(true);
      const found = keys.find((k: Record<string, unknown>) => k.id === createdKeyId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Test Agent Key');
      expect(found.key).toBeUndefined();
      expect(found.key_hash).toBeUndefined();
    });

    it('DELETE /api/api-keys/:id revokes a key', async () => {
      const res = await req(`/api/api-keys/${createdKeyId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.revoked).toBe(true);
    });

    it('revoked key no longer appears as active', async () => {
      const res = await req('/api/api-keys', {
        headers: authHeaders(),
      });
      const keys = await res.json();
      const found = keys.find((k: Record<string, unknown>) => k.id === createdKeyId);
      expect(found.revoked_at).not.toBeNull();
    });
  });

  // ── Connections ─────────────────────────────────────────────────────

  describe('Connections', () => {
    let connId: string;

    it('POST /api/connections creates a connection with default policy', async () => {
      const res = await req('/api/connections', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          provider_id: 'google_calendar',
          account_name: 'test@gmail.com',
          credentials: { access_token: 'tok_123', refresh_token: 'ref_456' },
          policy_yaml: MOCK_POLICY,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toMatch(/^conn_/);
      expect(body.provider_id).toBe('google_calendar');
      connId = body.id;
    });

    it('GET /api/connections lists connections without credentials', async () => {
      const res = await req('/api/connections', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const conns = await res.json();
      expect(Array.isArray(conns)).toBe(true);
      const found = conns.find((c: Record<string, unknown>) => c.id === connId);
      expect(found).toBeDefined();
      expect(found.credentials).toBeUndefined();
      expect(found.credentials_encrypted).toBeUndefined();
    });

    it('DELETE /api/connections/:id removes a connection', async () => {
      const res = await req(`/api/connections/${connId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
    });

    it('DELETE /api/connections/:id returns 404 for invalid id', async () => {
      const res = await req('/api/connections/conn_nonexistent', {
        method: 'DELETE',
        headers: authHeaders(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── OAuth ───────────────────────────────────────────────────────────

  describe('OAuth', () => {
    it('GET /api/connections/oauth/:providerId/start redirects to provider authorize URL', async () => {
      const res = await req(
        `/api/connections/oauth/google_calendar/start?token=${TEST_ADMIN_TOKEN}`,
      );
      expect(res.status).toBe(302);
      const location = res.headers.get('Location') ?? '';
      expect(location).toContain('accounts.google.com');
      expect(location).toContain('client_id=');
      expect(location).toContain('redirect_uri=');
      expect(location).toContain('scope=');
    });

    it('GET /api/connections/oauth/:providerId/start returns 400 for unknown provider', async () => {
      const res = await req(
        `/api/connections/oauth/nonexistent/start?token=${TEST_ADMIN_TOKEN}`,
      );
      expect(res.status).toBe(400);
    });
  });

  // ── Policies ────────────────────────────────────────────────────────

  describe('Policies', () => {
    let connId: string;

    beforeAll(async () => {
      const res = await req('/api/connections', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          provider_id: 'google_calendar',
          account_name: 'policy-test@gmail.com',
          credentials: { access_token: 'tok', refresh_token: 'ref' },
          policy_yaml: MOCK_POLICY,
        }),
      });
      const body = await res.json();
      connId = body.id;
    });

    it('GET /api/connections/:id/policy returns YAML', async () => {
      const res = await req(`/api/connections/${connId}/policy`, {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('provider: google_calendar');
      expect(text).toContain('list_calendars');
    });

    it('PUT /api/connections/:id/policy updates YAML', async () => {
      const newPolicy = `provider: google_calendar
account: policy-test@gmail.com

operations:
  list_calendars:
    allow: true
`;
      const res = await req(`/api/connections/${connId}/policy`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}`, 'Content-Type': 'text/yaml' },
        body: newPolicy,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updated).toBe(true);

      // Verify it was saved
      const getRes = await req(`/api/connections/${connId}/policy`, {
        headers: authHeaders(),
      });
      const text = await getRes.text();
      expect(text).toContain('list_calendars');
      expect(text).not.toContain('create_event');
    });

    it('PUT /api/connections/:id/policy rejects invalid YAML', async () => {
      const res = await req(`/api/connections/${connId}/policy`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}`, 'Content-Type': 'text/yaml' },
        body: 'not: [valid: yaml: policy',
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid policy YAML');
    });
  });

  // ── Audit ───────────────────────────────────────────────────────────

  describe('Audit', () => {
    beforeAll(() => {
      // Insert some audit entries for testing
      insertAuditEntry({
        tool_name: 'gcal_list_calendars',
        result: 'allowed',
        duration_ms: 150,
      });
      insertAuditEntry({
        tool_name: 'gcal_create_event',
        result: 'denied',
        deny_reason: 'Constraint failed: calendarId must_equal "primary"',
        duration_ms: 5,
      });
      insertAuditEntry({
        tool_name: 'gcal_list_events',
        result: 'allowed',
        duration_ms: 200,
      });
    });

    it('GET /api/audit returns entries', async () => {
      const res = await req('/api/audit', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const entries = await res.json();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/audit?result=denied filters entries', async () => {
      const res = await req('/api/audit?result=denied', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const entries = await res.json();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      for (const entry of entries) {
        expect(entry.result).toBe('denied');
      }
    });

    it('GET /api/audit?limit=1 respects limit', async () => {
      const res = await req('/api/audit?limit=1', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const entries = await res.json();
      expect(entries.length).toBe(1);
    });
  });

  // ── Settings ────────────────────────────────────────────────────────

  describe('Settings', () => {
    it('GET /api/settings/oauth/:providerId returns status', async () => {
      const res = await req('/api/settings/oauth/google_calendar', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.configured).toBe('boolean');
    });

    it('PUT /api/settings/oauth/:providerId saves credentials', async () => {
      const res = await req('/api/settings/oauth/google_calendar', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          client_id: 'test-client-id-12345',
          client_secret: 'test-client-secret-67890',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.saved).toBe(true);

      // Verify it was saved
      const getRes = await req('/api/settings/oauth/google_calendar', {
        headers: authHeaders(),
      });
      const getBody = await getRes.json();
      expect(getBody.configured).toBe(true);
      expect(getBody.client_id).toBe('test-client-...');
    });

    it('PUT /api/settings/oauth/:providerId rejects missing fields', async () => {
      const res = await req('/api/settings/oauth/google_calendar', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ client_id: 'only-id' }),
      });
      expect(res.status).toBe(400);
    });

    it('GET /api/settings/oauth/:providerId returns 400 for unknown provider', async () => {
      const res = await req('/api/settings/oauth/nonexistent', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Status ──────────────────────────────────────────────────────────

  describe('Status', () => {
    it('GET /api/status returns connections, tools, apiKeys, oauthProviders', async () => {
      const res = await req('/api/status', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.connections)).toBe(true);
      expect(Array.isArray(body.tools)).toBe(true);
      expect(typeof body.apiKeys.total).toBe('number');
      expect(typeof body.apiKeys.active).toBe('number');
      expect(Array.isArray(body.oauthProviders)).toBe(true);
    });

    it('GET /api/status connections include meta fields', async () => {
      // Create a connection first
      await req('/api/connections', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          provider_id: 'google_calendar',
          account_name: 'status-test@gmail.com',
          credentials: { access_token: 'tok', refresh_token: 'ref' },
          policy_yaml: MOCK_POLICY,
        }),
      });

      const res = await req('/api/status', {
        headers: authHeaders(),
      });
      const body = await res.json();
      const conn = body.connections.find((c: Record<string, unknown>) => c.account_name === 'status-test@gmail.com');
      expect(conn).toBeDefined();
      expect(typeof conn.enabledTools).toBe('number');
      expect(typeof conn.totalTools).toBe('number');
      expect(['valid', 'expired', 'unknown']).toContain(conn.tokenStatus);
      expect(conn.displayName).toBeTruthy();
    });
  });

  // ── Policy Validation ─────────────────────────────────────────────

  describe('Policy Validation', () => {
    let connId: string;

    beforeAll(async () => {
      const res = await req('/api/connections', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          provider_id: 'google_calendar',
          account_name: 'validate-test@gmail.com',
          credentials: { access_token: 'tok', refresh_token: 'ref' },
          policy_yaml: MOCK_POLICY,
        }),
      });
      const body = await res.json();
      connId = body.id || body.connId;
      if (!connId) {
        // May have been an update (existing connection)
        const listRes = await req('/api/connections', { headers: authHeaders() });
        const conns = await listRes.json();
        connId = conns.find((c: Record<string, unknown>) => c.account_name === 'validate-test@gmail.com')?.id;
      }
    });

    it('POST validate returns valid: true with tools and warnings', async () => {
      const res = await req(`/api/connections/${connId}/policy/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}`, 'Content-Type': 'text/yaml' },
        body: MOCK_POLICY,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(true);
      expect(Array.isArray(body.tools)).toBe(true);
      expect(Array.isArray(body.warnings)).toBe(true);
    });

    it('POST validate returns valid: false for invalid YAML', async () => {
      const res = await req(`/api/connections/${connId}/policy/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}`, 'Content-Type': 'text/yaml' },
        body: 'not: [valid: yaml: policy',
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(false);
      expect(typeof body.error).toBe('string');
    });

    it('POST validate returns warnings for unknown keys', async () => {
      const yamlWithWarnings = `
provider: google_calendar
account: test@gmail.com
extra_key: should_warn
operations:
  list_calendars:
    allow: true
`;
      const res = await req(`/api/connections/${connId}/policy/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}`, 'Content-Type': 'text/yaml' },
        body: yamlWithWarnings,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(true);
      expect(body.warnings.length).toBeGreaterThan(0);
    });
  });

  // ── Provider Reference ────────────────────────────────────────────

  describe('Provider Reference', () => {
    it('GET /api/providers/:id/reference returns provider info', async () => {
      const res = await req('/api/providers/google_calendar/reference', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.provider.id).toBe('google_calendar');
      expect(body.provider.displayName).toBeTruthy();
      expect(Array.isArray(body.operations)).toBe(true);
      expect(body.operations.length).toBeGreaterThan(0);
      expect(Array.isArray(body.constraints)).toBe(true);
      expect(Array.isArray(body.mutations)).toBe(true);
      expect(typeof body.example).toBe('string');
    });

    it('GET /api/providers/:id/reference returns 404 for unknown provider', async () => {
      const res = await req('/api/providers/nonexistent/reference', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Doctor ──────────────────────────────────────────────────────────

  describe('Doctor', () => {
    it('GET /api/doctor returns check results array', async () => {
      const res = await req('/api/doctor', {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      for (const check of body) {
        expect(check.id).toBeTruthy();
        expect(check.name).toBeTruthy();
        expect(['pass', 'warn', 'fail', 'skip']).toContain(check.status);
        expect(typeof check.message).toBe('string');
        expect(typeof check.fixable).toBe('boolean');
      }
    });

    it('POST /api/doctor/fix returns check results with fix attempts', async () => {
      const res = await req('/api/doctor/fix', {
        method: 'POST',
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });
});
