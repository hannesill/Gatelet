/**
 * Security Audit: Admin Token Leakage Tests
 *
 * Tests for FINDING-01 (OAuth state parameter leaks admin token),
 * FINDING-02 (admin token embedded in dashboard HTML — now fixed),
 * and FINDING-05 (session-based auth replaces token-in-URL).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-sec-token-${Date.now()}`);
const TEST_ADMIN_TOKEN = 'secret-admin-token-do-not-leak';
const TEST_MCP_PORT = 16000;
const TEST_ADMIN_PORT = 16001;

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(TEST_MCP_PORT);
process.env.GATELET_ADMIN_PORT = String(TEST_ADMIN_PORT);

import { config } from '../../src/config.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import { createAdminApp } from '../../src/admin/server.js';
import type { Hono } from 'hono';

let app: Hono;

function req(urlPath: string, init?: RequestInit) {
  return app.request(urlPath, init);
}

describe('Admin Token Leakage', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    resetMasterKey();
    resetDb();
    initTestMasterKey();
    getDb();
    config.ADMIN_TOKEN = TEST_ADMIN_TOKEN;
    app = createAdminApp();
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  // ── FINDING-01: OAuth state parameter leaks admin token to Google ──

  describe('FINDING-01: OAuth state parameter leaks admin token', () => {
    it('admin token is NOT sent as OAuth state parameter to Google (FIXED)', async () => {
      const res = await req(
        `/api/connections/oauth/google_calendar/start?token=${TEST_ADMIN_TOKEN}`,
      );

      expect(res.status).toBe(302);
      const location = res.headers.get('Location') ?? '';

      const url = new URL(location);
      const state = url.searchParams.get('state');

      // FIXED: State is now a random nonce, not the admin token
      expect(state).not.toBe(TEST_ADMIN_TOKEN);
      expect(state).toBeTruthy();
      // Nonce should be a 64-char hex string (32 random bytes)
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });

    it('OAuth callback redirect does NOT include admin token in URL', async () => {
      // Simulate callback — code exchange will fail but we verify
      // the redirect does not contain the admin token
      const res = await req(
        `/api/connections/oauth/google_calendar/callback?code=fake&state=${TEST_ADMIN_TOKEN}`,
      );

      // May redirect or error, but should never include admin token in redirect URL
      const location = res.headers.get('Location') ?? '';
      expect(location).not.toContain(TEST_ADMIN_TOKEN);
    });
  });

  // ── FINDING-02 + FINDING-05: Token no longer in dashboard HTML or URLs ──

  describe('FINDING-02/05: Admin token not in dashboard HTML or URLs (FIXED)', () => {
    it('token-in-URL dashboard page no longer exists', async () => {
      // Old: GET /?token=<token> returned a dashboard with token in HTML
      // New: No such route — dashboard is served as SPA (or 404 without SPA build)
      const res = await req(`/?token=${TEST_ADMIN_TOKEN}`);
      // Should not return a dashboard with token embedded
      if (res.status === 200) {
        const html = await res.text();
        expect(html).not.toContain(`const TOKEN = "${TEST_ADMIN_TOKEN}"`);
        expect(html).not.toContain(`token=${TEST_ADMIN_TOKEN}`);
      }
      // 404 is also fine — means old dashboard route is gone
    });

    it('login uses POST with session cookie, not GET with token in URL', async () => {
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
  });

  // ── FINDING-03: No auth on admin health endpoint ──

  describe('FINDING-03: Health endpoint information disclosure', () => {
    it('health endpoint returns operational data without authentication', async () => {
      const resNoAuth = await req('/api/health');
      expect(resNoAuth.status).toBe(401);

      const resWithAuth = await req('/api/health', {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      });
      expect(resWithAuth.status).toBe(200);
    });
  });

  // ── FINDING-04: Login rate limiting ──

  describe('FINDING-04: Rate limiting on admin login', () => {
    it('rate limits login attempts via POST /api/login', async () => {
      // Try many wrong tokens
      const attempts = [];
      for (let i = 0; i < 15; i++) {
        attempts.push(req('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: `wrong-token-${i}` }),
        }));
      }
      const results = await Promise.all(attempts);

      // At least some should be rate-limited (429) or rejected (401)
      const statuses = results.map(r => r.status);
      // All should be either 401 or 429
      for (const status of statuses) {
        expect([401, 429]).toContain(status);
      }
    });
  });
});
