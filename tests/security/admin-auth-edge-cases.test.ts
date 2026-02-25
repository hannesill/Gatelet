/**
 * Security: Admin authentication middleware edge cases.
 *
 * Tests for boundary conditions in the admin server auth middleware
 * that could lead to authentication bypass if not handled correctly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-auth-edge-${Date.now()}`);
const TEST_ADMIN_TOKEN = 'admin-auth-edge-test-token-xyz';
const TEST_MCP_PORT = 21000;
const TEST_ADMIN_PORT = 21001;

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

describe('Admin auth edge cases', () => {
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

  describe('Bearer token edge cases', () => {
    it('rejects Bearer token that is a prefix of the admin token', async () => {
      const res = await req('/api/api-keys', {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN.slice(0, 10)}` },
      });
      expect(res.status).toBe(401);
    });

    it('Bearer token with trailing whitespace is trimmed by Hono', async () => {
      // Hono (or the underlying Request API) trims header values,
      // so a trailing space does not cause rejection. This is safe
      // because it means the correct token still matches.
      const res = await req('/api/api-keys', {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN} ` },
      });
      expect(res.status).toBe(200);
    });

    it('rejects empty Bearer token', async () => {
      const res = await req('/api/api-keys', {
        headers: { Authorization: 'Bearer' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects Basic auth scheme', async () => {
      const encoded = Buffer.from(`admin:${TEST_ADMIN_TOKEN}`).toString('base64');
      const res = await req('/api/api-keys', {
        headers: { Authorization: `Basic ${encoded}` },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Session cookie edge cases', () => {
    it('rejects malformed cookie header', async () => {
      const res = await req('/api/api-keys', {
        headers: { Cookie: 'gatelet_session' }, // no =value
      });
      expect(res.status).toBe(401);
    });

    it('rejects empty session cookie value', async () => {
      const res = await req('/api/api-keys', {
        headers: { Cookie: 'gatelet_session=' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects forged session cookie', async () => {
      const forged = 'a'.repeat(64); // Same length as real session
      const res = await req('/api/api-keys', {
        headers: { Cookie: `gatelet_session=${forged}` },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('OAuth callback is unauthenticated', () => {
    it('OAuth callback endpoint does not require auth', async () => {
      // OAuth callbacks come from the OAuth provider redirect,
      // so they must be accessible without authentication
      const res = await req(
        '/api/connections/oauth/google_calendar/callback?code=test',
      );
      // Should not be 401 -- it will likely fail on token exchange
      // but the point is it doesn't reject at the auth layer
      expect(res.status).not.toBe(401);
    });

    it('non-OAuth API routes still require auth', async () => {
      const res = await req('/api/connections');
      expect(res.status).toBe(401);
    });
  });

  describe('Login endpoint validation', () => {
    it('rejects login with empty body', async () => {
      const res = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('rejects login with null token', async () => {
      const res = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: null }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects login with numeric token', async () => {
      const res = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 12345 }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects login with token as array', async () => {
      const res = await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: [TEST_ADMIN_TOKEN] }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Logout does not require valid session', () => {
    it('logout with no session returns 200', async () => {
      const res = await req('/api/logout', {
        method: 'POST',
      });
      expect(res.status).toBe(200);
    });

    it('logout with invalid session still clears cookie', async () => {
      const res = await req('/api/logout', {
        method: 'POST',
        headers: { Cookie: 'gatelet_session=invalid' },
      });
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).toContain('Max-Age=0');
    });
  });
});
