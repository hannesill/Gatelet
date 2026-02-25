import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import { createConnection, getConnectionWithCredentials } from '../../src/db/connections.js';
import { createApiKey, validateApiKey } from '../../src/db/api-keys.js';

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

describe('Data layer integration', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    resetMasterKey();
    resetDb();
    initTestMasterKey();
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

    it('decrypts credentials correctly after creation', () => {
      const conn = createConnection({
        provider_id: 'google_calendar',
        account_name: 'decrypt-test@gmail.com',
        credentials: { access_token: 'secret_tok', refresh_token: 'secret_ref' },
        policy_yaml: MOCK_POLICY,
      });

      const withCreds = getConnectionWithCredentials(conn.id);
      expect(withCreds).toBeDefined();
      expect(withCreds!.credentials.access_token).toBe('secret_tok');
      expect(withCreds!.credentials.refresh_token).toBe('secret_ref');
    });

    it('connection listing never exposes credentials', () => {
      const conn = createConnection({
        provider_id: 'google_calendar',
        account_name: 'no-leak@gmail.com',
        credentials: { access_token: 'dont_leak_this' },
        policy_yaml: MOCK_POLICY,
      });

      // The getConnection (without credentials) should not have credential data
      const connJson = JSON.stringify(conn);
      expect(connJson).not.toContain('dont_leak_this');
      expect(connJson).not.toContain('credentials');
    });
  });
});
