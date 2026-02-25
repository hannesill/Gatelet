import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TOTP, Secret } from 'otpauth';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-totp-test-${Date.now()}`);
const TEST_ADMIN_TOKEN = 'totp-test-admin-token';
const TEST_MCP_PORT = 19000;
const TEST_ADMIN_PORT = 19001;

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(TEST_MCP_PORT);
process.env.GATELET_ADMIN_PORT = String(TEST_ADMIN_PORT);

import { config } from '../../src/config.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import { createAdminApp } from '../../src/admin/server.js';
import { getSetting, deleteSetting } from '../../src/db/settings.js';
import { resetPendingSecret } from '../../src/admin/routes/totp.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
  hashBackupCode,
} from '../../src/admin/totp.js';
import type { Hono } from 'hono';

let app: Hono;

function req(urlPath: string, init?: RequestInit) {
  return app.request(urlPath, init);
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Helper to get a valid session cookie
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

describe('TOTP Module', () => {
  it('generateTotpSecret returns secret and uri', () => {
    const { secret, uri } = generateTotpSecret();
    expect(secret).toBeTruthy();
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('Gatelet');
  });

  it('verifyTotpCode validates a correct code', () => {
    const { secret } = generateTotpSecret();
    // Generate the current code
    const totp = new TOTP({
      issuer: 'Gatelet',
      label: 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    const code = totp.generate();
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it('verifyTotpCode rejects an incorrect code', () => {
    const { secret } = generateTotpSecret();
    expect(verifyTotpCode(secret, '000000')).toBe(false);
  });

  it('generateBackupCodes returns 8 codes and hashes', () => {
    const { codes, hashes } = generateBackupCodes();
    expect(codes).toHaveLength(8);
    expect(hashes).toHaveLength(8);
    // All codes are 8 char uppercase hex
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    }
  });

  it('verifyBackupCode matches and consumes a valid code', () => {
    const { codes, hashes } = generateBackupCodes();
    const result = verifyBackupCode(codes[0], hashes);
    expect(result.valid).toBe(true);
    expect(result.remainingHashes).toHaveLength(7);
  });

  it('verifyBackupCode rejects an invalid code', () => {
    const { hashes } = generateBackupCodes();
    const result = verifyBackupCode('ZZZZZZZZ', hashes);
    expect(result.valid).toBe(false);
    expect(result.remainingHashes).toHaveLength(8);
  });

  it('verifyBackupCode is case-insensitive', () => {
    const { codes, hashes } = generateBackupCodes();
    const result = verifyBackupCode(codes[0].toLowerCase(), hashes);
    expect(result.valid).toBe(true);
  });
});

describe('TOTP Routes', () => {
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

  beforeEach(() => {
    // Clean up TOTP settings
    try {
      deleteSetting('totp_secret');
      deleteSetting('totp_enabled');
      deleteSetting('totp_backup_codes');
    } catch {
      // ignore if settings don't exist yet
    }
    resetPendingSecret();
  });

  it('GET /api/totp/status returns disabled by default', async () => {
    const cookie = await getSessionCookie();
    const res = await req('/api/totp/status', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.backupCodesRemaining).toBe(0);
  });

  it('POST /api/totp/setup returns secret and uri', async () => {
    const cookie = await getSessionCookie();
    const res = await req('/api/totp/setup', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secret).toBeTruthy();
    expect(body.uri).toContain('otpauth://');
  });

  it('full setup flow: setup → verify → status shows enabled', async () => {
    const cookie = await getSessionCookie();

    // Step 1: Get setup secret
    const setupRes = await req('/api/totp/setup', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { secret } = await setupRes.json();

    // Step 2: Generate a valid code
    const totp = new TOTP({
      issuer: 'Gatelet',
      label: 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    const code = totp.generate();

    // Step 3: Verify
    const verifyRes = await req('/api/totp/verify-setup', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.enabled).toBe(true);
    expect(verifyBody.backupCodes).toHaveLength(8);

    // Step 4: Status should show enabled
    const statusRes = await req('/api/totp/status', {
      headers: { Cookie: cookie },
    });
    const statusBody = await statusRes.json();
    expect(statusBody.enabled).toBe(true);
    expect(statusBody.backupCodesRemaining).toBe(8);
  });

  it('login requires 2FA code when TOTP is enabled', async () => {
    const cookie = await getSessionCookie();

    // Enable TOTP
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
    const code = totp.generate();

    await req('/api/totp/verify-setup', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    // Now try to login without TOTP code
    const loginRes1 = await req('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TEST_ADMIN_TOKEN }),
    });
    expect(loginRes1.status).toBe(200);
    const loginBody1 = await loginRes1.json();
    expect(loginBody1.requires2FA).toBe(true);

    // Login with valid TOTP code
    const newCode = totp.generate();
    const loginRes2 = await req('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TEST_ADMIN_TOKEN, totpCode: newCode }),
    });
    expect(loginRes2.status).toBe(200);
    const loginBody2 = await loginRes2.json();
    expect(loginBody2.ok).toBe(true);
  });

  it('login with backup code works and consumes it', async () => {
    const cookie = await getSessionCookie();

    // Enable TOTP
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

    const verifyRes = await req('/api/totp/verify-setup', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totp.generate() }),
    });
    const { backupCodes } = await verifyRes.json();

    // Login with backup code
    const loginRes = await req('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TEST_ADMIN_TOKEN, totpCode: backupCodes[0] }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.ok).toBe(true);

    // Check backup count decreased
    const statusRes = await req('/api/totp/status', {
      headers: { Cookie: cookie },
    });
    const statusBody = await statusRes.json();
    expect(statusBody.backupCodesRemaining).toBe(7);
  });

  it('disable TOTP with valid code', async () => {
    const cookie = await getSessionCookie();

    // Enable TOTP
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

    // Disable
    const disableRes = await req('/api/totp/disable', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totp.generate() }),
    });
    expect(disableRes.status).toBe(200);
    const disableBody = await disableRes.json();
    expect(disableBody.disabled).toBe(true);

    // Verify disabled
    const statusRes = await req('/api/totp/status', {
      headers: { Cookie: cookie },
    });
    const statusBody = await statusRes.json();
    expect(statusBody.enabled).toBe(false);
  });
});
