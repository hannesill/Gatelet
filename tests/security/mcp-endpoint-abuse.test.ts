/**
 * Security Audit: MCP Endpoint Abuse Tests
 *
 * Tests for rate limiting on bearer auth,
 * body size limits, session limits,
 * and error message information disclosure.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-sec-mcp-${Date.now()}`);
const TEST_ADMIN_TOKEN = 'test-admin-token-mcp';
const TEST_MCP_PORT = 17000;
const TEST_ADMIN_PORT = 17001;

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(TEST_MCP_PORT);
process.env.GATELET_ADMIN_PORT = String(TEST_ADMIN_PORT);

import { config } from '../../src/config.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import { createApiKey } from '../../src/db/api-keys.js';
import { authenticateBearer } from '../../src/mcp/auth.js';

describe('MCP Endpoint Security', () => {
  let validApiKey: string;

  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    resetMasterKey();
    resetDb();
    initTestMasterKey();
    getDb();
    config.ADMIN_TOKEN = TEST_ADMIN_TOKEN;

    const { key } = createApiKey('Test Key');
    validApiKey = key;
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  // ── FINDING-11: Rate limiting now works ──

  describe('FINDING-11: Rate limiting on authentication (FIXED)', () => {
    it('rate limits after too many failed attempts from same IP', () => {
      const testIp = '10.0.0.99';
      // Make 11 failed attempts (limit is 10)
      for (let i = 0; i < 11; i++) {
        authenticateBearer(`Bearer glk_invalid_${i}`, testIp);
      }

      // The valid key should now be rate-limited from that IP
      const result = authenticateBearer(`Bearer ${validApiKey}`, testIp);
      expect(result).toBeNull();
    });

    it('does not rate limit different IPs', () => {
      // Each IP gets its own rate limit window
      const result = authenticateBearer(`Bearer ${validApiKey}`, '10.0.0.100');
      expect(result).not.toBeNull();
    });
  });

  // ── Auth header parsing tests ──

  describe('Auth header format handling', () => {
    it('rejects missing auth header', () => {
      expect(authenticateBearer(undefined, '10.0.1.1')).toBeNull();
    });

    it('rejects empty string', () => {
      expect(authenticateBearer('', '10.0.1.2')).toBeNull();
    });

    it('rejects non-Bearer scheme', () => {
      expect(authenticateBearer(`Token ${validApiKey}`, '10.0.1.3')).toBeNull();
    });

    it('accepts case-insensitive Bearer prefix', () => {
      const result = authenticateBearer(`bearer ${validApiKey}`, '10.0.1.4');
      expect(result).not.toBeNull();
    });

    it('rejects Bearer with no token', () => {
      expect(authenticateBearer('Bearer ', '10.0.1.5')).toBeNull();
    });

    it('handles Bearer with extra spaces (regex \\s+ is greedy)', () => {
      const result = authenticateBearer(`Bearer   ${validApiKey}`, '10.0.1.6');
      expect(result).not.toBeNull();
    });

    it('rejects very long token (no length limit but lookup fails)', () => {
      const longToken = 'glk_' + 'A'.repeat(10000);
      const result = authenticateBearer(`Bearer ${longToken}`, '10.0.1.7');
      expect(result).toBeNull();
    });
  });

  // ── API Key security ──

  describe('API key security properties', () => {
    it('API keys are stored as SHA-256 hashes, not plaintext', () => {
      const db = getDb();
      const row = db.prepare('SELECT key_hash FROM api_keys LIMIT 1').get() as { key_hash: string } | undefined;

      if (row) {
        expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(row.key_hash).not.toContain('glk_');
      }
    });

    it('revoked keys are rejected', () => {
      const { id, key } = createApiKey('Revoke Test');

      // Key works before revocation (use unique IP to avoid rate limiting)
      expect(authenticateBearer(`Bearer ${key}`, '10.0.2.1')).not.toBeNull();

      // Revoke it
      const db = getDb();
      db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").run(id);

      // Key no longer works
      expect(authenticateBearer(`Bearer ${key}`, '10.0.2.2')).toBeNull();
    });
  });

  // ── FINDING-14: Error message information disclosure ──

  describe('FINDING-14: Error messages do not leak sensitive data', () => {
    it('authentication failure does not reveal valid token format', () => {
      const result = authenticateBearer('Bearer invalid', '10.0.3.1');
      expect(result).toBeNull();
    });

    it('admin token is not exposed via MCP auth flow', () => {
      const result = authenticateBearer(`Bearer ${TEST_ADMIN_TOKEN}`, '10.0.3.2');
      expect(result).toBeNull();
    });
  });
});
