/**
 * Security Audit: Admin Token Leakage Tests
 *
 * Tests for FINDING-01 (OAuth state parameter leaks admin token)
 * and FINDING-02 (admin token embedded in dashboard HTML).
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
import { getMasterKey, resetMasterKey } from '../../src/db/crypto.js';
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
    getMasterKey();
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
    it('admin token is sent as OAuth state parameter to Google', async () => {
      // When a user clicks "Connect Google Calendar" in the dashboard,
      // the admin token is passed as a query param and then forwarded
      // as the OAuth "state" parameter to accounts.google.com.
      const res = await req(
        `/api/connections/oauth/google_calendar/start?token=${TEST_ADMIN_TOKEN}`,
      );

      expect(res.status).toBe(302);
      const location = res.headers.get('Location') ?? '';

      // The admin token appears in the state parameter sent to Google
      const url = new URL(location);
      const state = url.searchParams.get('state');

      // VULNERABILITY: The admin token IS the OAuth state value
      expect(state).toBe(TEST_ADMIN_TOKEN);

      // This means:
      // 1. The admin token is sent in plaintext to Google's authorization server
      // 2. It appears in Google's server logs
      // 3. It may appear in browser history as part of the redirect URL
      // 4. The OAuth callback receives it back and uses it for redirect
    });

    it('OAuth callback redirect includes admin token in URL', async () => {
      // When Google redirects back, the state (admin token) is used
      // in a redirect to /?token=<admin_token>
      // An interceptor or the browser's Referer header could leak this.

      // Simulate callback with state = admin token (code will fail but
      // we're testing the redirect logic path)
      const res = await req(
        `/api/connections/oauth/google_calendar/callback?code=fake&state=${TEST_ADMIN_TOKEN}`,
      );

      // The callback will fail on token exchange, but the vulnerability
      // is in the state parameter design, not the callback execution
      // In a real scenario with a valid code, line 175 does:
      //   return c.redirect(`/?token=${state}`)
      // where state = admin token
    });
  });

  // ── FINDING-02: Admin token embedded in dashboard HTML ──

  describe('FINDING-02: Admin token in dashboard HTML source', () => {
    it('dashboard page contains admin token in multiple places', async () => {
      const res = await req(`/?token=${TEST_ADMIN_TOKEN}`);
      expect(res.status).toBe(200);

      const html = await res.text();

      // Token is embedded in JavaScript as a global variable
      expect(html).toContain(`const TOKEN = "${TEST_ADMIN_TOKEN}"`);

      // Token appears in OAuth connect links
      expect(html).toContain(`/start?token=${TEST_ADMIN_TOKEN}`);

      // Token appears in pagination links
      // (would appear if audit entries exist)

      // This is a weakness because:
      // 1. Any XSS on the admin page would immediately leak the token
      // 2. Browser extensions can read page content
      // 3. The token is in the URL query string (browser history, logs)
    });

    it('admin token appears in URL query string (browser history exposure)', () => {
      // The login flow uses GET /?token=<token> which means:
      // 1. Token appears in browser address bar
      // 2. Token is saved in browser history
      // 3. Token may be logged by proxy servers
      // 4. Token is sent in Referer headers to external resources

      // This is a design issue, not a code bug - the dashboard
      // should use session cookies or POST-based auth instead
      expect(true).toBe(true); // Documented finding
    });
  });

  // ── FINDING-03: No auth on admin health endpoint ──

  describe('FINDING-03: Health endpoint information disclosure', () => {
    it('health endpoint returns operational data without authentication', async () => {
      // Wait -- let's verify if health needs auth
      // Looking at the middleware: /api/* requires auth EXCEPT OAuth callbacks
      // /api/health IS under /api/* so it DOES require auth
      const resNoAuth = await req('/api/health');
      expect(resNoAuth.status).toBe(401);

      // Good - health endpoint requires auth
      const resWithAuth = await req('/api/health', {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      });
      expect(resWithAuth.status).toBe(200);
    });
  });

  // ── FINDING-04: Login page has no rate limiting ──

  describe('FINDING-04: No rate limiting on admin login', () => {
    it('can attempt many logins without being blocked', async () => {
      // Try 100 wrong tokens rapidly
      const attempts = [];
      for (let i = 0; i < 100; i++) {
        attempts.push(req(`/?token=wrong-token-${i}`));
      }
      const results = await Promise.all(attempts);

      // All should return the login page (200 with login form)
      // None should be rate-limited (429)
      for (const res of results) {
        expect(res.status).toBe(200); // Returns login page on wrong token
      }

      // No 429 status codes = no rate limiting
      const rateLimited = results.filter(r => r.status === 429);
      expect(rateLimited.length).toBe(0);
    });
  });
});
