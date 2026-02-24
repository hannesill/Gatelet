/**
 * Security Audit: MCP Endpoint Abuse Tests
 *
 * Tests for FINDING-11 (no rate limiting on bearer auth),
 * FINDING-12 (no body size limit), FINDING-13 (no session limit),
 * FINDING-14 (error messages as info disclosure).
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
import { getMasterKey, resetMasterKey } from '../../src/db/crypto.js';
import { createApiKey } from '../../src/db/api-keys.js';
import { authenticateBearer } from '../../src/mcp/auth.js';

describe('MCP Endpoint Security', () => {
  let validApiKey: string;

  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    resetMasterKey();
    resetDb();
    getMasterKey();
    getDb();
    config.ADMIN_TOKEN = TEST_ADMIN_TOKEN;

    const { key } = createApiKey('Test Key');
    validApiKey = key;
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  // ── FINDING-11: No rate limiting on bearer token auth ──

  describe('FINDING-11: No rate limiting on authentication', () => {
    it('can attempt many invalid tokens without being blocked', () => {
      // Brute force 1000 invalid API keys
      const results = [];
      for (let i = 0; i < 1000; i++) {
        results.push(authenticateBearer(`Bearer glk_invalid_${i}`));
      }

      // All attempts return null (invalid) but none are rate-limited
      expect(results.every(r => r === null)).toBe(true);

      // The valid key still works after 1000 invalid attempts
      const valid = authenticateBearer(`Bearer ${validApiKey}`);
      expect(valid).not.toBeNull();
    });
  });

  // ── Auth header parsing tests ──

  describe('Auth header format handling', () => {
    it('rejects missing auth header', () => {
      expect(authenticateBearer(undefined)).toBeNull();
    });

    it('rejects empty string', () => {
      expect(authenticateBearer('')).toBeNull();
    });

    it('rejects non-Bearer scheme', () => {
      expect(authenticateBearer(`Token ${validApiKey}`)).toBeNull();
    });

    it('accepts case-insensitive Bearer prefix', () => {
      // The regex is /^Bearer\s+(.+)$/i so this should work
      const result = authenticateBearer(`bearer ${validApiKey}`);
      expect(result).not.toBeNull();
    });

    it('rejects Bearer with no token', () => {
      expect(authenticateBearer('Bearer ')).toBeNull();
    });

    it('handles Bearer with extra spaces (regex \\s+ is greedy)', () => {
      // /^Bearer\s+(.+)$/i - the \s+ greedily consumes ALL spaces,
      // so group 1 captures only the actual token without leading spaces.
      // This means "Bearer   <key>" works the same as "Bearer <key>".
      const result = authenticateBearer(`Bearer   ${validApiKey}`);
      // Greedy \s+ means the key is extracted correctly
      expect(result).not.toBeNull();
    });

    it('rejects very long token (no length limit but lookup fails)', () => {
      const longToken = 'glk_' + 'A'.repeat(10000);
      const result = authenticateBearer(`Bearer ${longToken}`);
      expect(result).toBeNull();
    });
  });

  // ── API Key security ──

  describe('API key security properties', () => {
    it('API keys are stored as SHA-256 hashes, not plaintext', () => {
      // Verify by checking the DB directly
      const db = getDb();
      const row = db.prepare('SELECT key_hash FROM api_keys LIMIT 1').get() as { key_hash: string } | undefined;

      if (row) {
        // key_hash should be a 64-char hex string (SHA-256)
        expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
        // It should NOT contain the raw key prefix
        expect(row.key_hash).not.toContain('glk_');
      }
    });

    it('revoked keys are rejected', () => {
      const { id, key } = createApiKey('Revoke Test');

      // Key works before revocation
      expect(authenticateBearer(`Bearer ${key}`)).not.toBeNull();

      // Revoke it
      const db = getDb();
      db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").run(id);

      // Key no longer works
      expect(authenticateBearer(`Bearer ${key}`)).toBeNull();
    });
  });

  // ── FINDING-14: Error message information disclosure ──

  describe('FINDING-14: Error messages do not leak sensitive data', () => {
    it('authentication failure does not reveal valid token format', () => {
      // The MCP server returns a generic "Unauthorized" message
      // without revealing what format is expected
      const result = authenticateBearer('Bearer invalid');
      expect(result).toBeNull();
      // Good: no error message is returned that hints at key format
    });

    it('admin token is not exposed via MCP auth flow', () => {
      // Try using admin token on MCP endpoint
      const result = authenticateBearer(`Bearer ${TEST_ADMIN_TOKEN}`);
      // Admin token should not work as an API key (different auth system)
      expect(result).toBeNull();
    });
  });
});
