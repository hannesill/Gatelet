import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-conn-test-${Date.now()}`);

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'test-token';

import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { getMasterKey, resetMasterKey } from '../../src/db/crypto.js';
import {
  createConnection,
  getConnection,
  getConnectionSettings,
  updateConnectionSettings,
} from '../../src/db/connections.js';

describe('Connection settings', () => {
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

  it('default settings_json is empty object string', () => {
    const conn = createConnection({
      provider_id: 'google_gmail',
      account_name: 'test@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: 'provider: google_gmail\naccount: test@gmail.com\noperations:\n  search:\n    allow: true',
    });
    expect(conn.settings_json).toBe('{}');
  });

  it('getConnectionSettings round-trips parsed object', () => {
    const conn = createConnection({
      provider_id: 'google_gmail',
      account_name: 'roundtrip@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: 'provider: google_gmail\naccount: roundtrip@gmail.com\noperations:\n  search:\n    allow: true',
    });

    updateConnectionSettings(conn.id, { emailAliasSuffix: '+agent', foo: 'bar' });
    const settings = getConnectionSettings(conn.id);
    expect(settings.emailAliasSuffix).toBe('+agent');
    expect(settings.foo).toBe('bar');
  });

  it('updateConnectionSettings persists across reads', () => {
    const conn = createConnection({
      provider_id: 'google_gmail',
      account_name: 'persist@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: 'provider: google_gmail\naccount: persist@gmail.com\noperations:\n  search:\n    allow: true',
    });

    updateConnectionSettings(conn.id, { calendarId: 'work' });

    // Read again via getConnection to verify it's in the DB
    const reloaded = getConnection(conn.id);
    expect(reloaded).toBeDefined();
    expect(JSON.parse(reloaded!.settings_json)).toEqual({ calendarId: 'work' });
  });
});
