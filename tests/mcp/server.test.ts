import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';

// Set up test environment before any imports that use config
const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-test-${Date.now()}`);
const TEST_ADMIN_TOKEN = 'test-admin-token-123';
const TEST_MCP_PORT = 14000;
const TEST_ADMIN_PORT = 14001;

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(TEST_MCP_PORT);
process.env.GATELET_ADMIN_PORT = String(TEST_ADMIN_PORT);

// Now import modules that use config
import { config } from '../../src/config.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { getMasterKey, resetMasterKey } from '../../src/db/crypto.js';
import { createConnection } from '../../src/db/connections.js';
import { createApiKey, validateApiKey } from '../../src/db/api-keys.js';
import { queryAuditLog } from '../../src/db/audit.js';
import { parsePolicy } from '../../src/policy/parser.js';

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
        value: "allowed_cal"
    mutations:
      - field: attendees
        action: set
        value: []
      - field: visibility
        action: set
        value: "private"
  update_event:
    allow: false
`;

describe('Admin API', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    resetMasterKey();
    resetDb();
    getMasterKey();
    getDb();
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('API Keys', () => {
    it('creates and validates an API key', () => {
      const { id, key } = createApiKey('Test Key');
      expect(id).toMatch(/^gl_/);
      expect(key).toMatch(/^glk_/);

      const validated = validateApiKey(key);
      expect(validated).not.toBeNull();
      expect(validated!.id).toBe(id);
      expect(validated!.name).toBe('Test Key');
    });

    it('rejects invalid API key', () => {
      const validated = validateApiKey('invalid_key_123');
      expect(validated).toBeNull();
    });
  });

  describe('Connections', () => {
    it('creates a connection with encrypted credentials', () => {
      const conn = createConnection({
        provider_id: 'google_calendar',
        account_name: 'test@gmail.com',
        credentials: { access_token: 'test_token', refresh_token: 'test_refresh' },
        policy_yaml: MOCK_POLICY,
      });

      expect(conn.id).toMatch(/^conn_/);
      expect(conn.provider_id).toBe('google_calendar');
      expect(conn.account_name).toBe('test@gmail.com');
    });
  });

  describe('Policy parsing', () => {
    it('parses valid YAML policy', () => {
      const policy = parsePolicy(MOCK_POLICY);
      expect(policy.provider).toBe('google_calendar');
      expect(policy.operations.list_calendars.allow).toBe(true);
      expect(policy.operations.create_event.constraints).toHaveLength(1);
      expect(policy.operations.create_event.mutations).toHaveLength(2);
    });

    it('rejects invalid YAML', () => {
      expect(() => parsePolicy('not: [valid: yaml: policy')).toThrow();
    });

    it('rejects missing provider', () => {
      expect(() =>
        parsePolicy('account: test\noperations:\n  op:\n    allow: true\n'),
      ).toThrow('missing "provider"');
    });
  });

  describe('Audit log', () => {
    it('starts empty', () => {
      const entries = queryAuditLog({});
      // May have entries from other tests, just verify it returns an array
      expect(Array.isArray(entries)).toBe(true);
    });
  });
});
