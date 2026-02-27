/**
 * Tests for the needs_reauth flag on connections.
 *
 * When a token refresh permanently fails (e.g. user revokes consent),
 * the connection is marked needs_reauth=1. Re-authorizing via OAuth clears it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-reauth-test-${Date.now()}`);

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'reauth-test-token';
process.env.GATELET_MCP_PORT = '20200';
process.env.GATELET_ADMIN_PORT = '20201';

import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import {
  createConnection,
  getConnection,
  setConnectionNeedsReauth,
  deleteConnection,
} from '../../src/db/connections.js';

const POLICY = `provider: google_calendar
account: reauth-test@gmail.com
operations:
  list_calendars:
    allow: true`;

describe('Connection needs_reauth flag', () => {
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

  it('new connections default to needs_reauth=0', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'reauth-default@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: POLICY,
    });

    try {
      expect(conn.needs_reauth).toBe(0);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('setConnectionNeedsReauth sets the flag', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'reauth-set@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: POLICY,
    });

    try {
      setConnectionNeedsReauth(conn.id, true);
      const updated = getConnection(conn.id);
      expect(updated!.needs_reauth).toBe(1);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('setConnectionNeedsReauth clears the flag', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'reauth-clear@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: POLICY,
    });

    try {
      setConnectionNeedsReauth(conn.id, true);
      expect(getConnection(conn.id)!.needs_reauth).toBe(1);

      setConnectionNeedsReauth(conn.id, false);
      expect(getConnection(conn.id)!.needs_reauth).toBe(0);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('setConnectionNeedsReauth is idempotent', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'reauth-idempotent@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: POLICY,
    });

    try {
      setConnectionNeedsReauth(conn.id, true);
      setConnectionNeedsReauth(conn.id, true);
      expect(getConnection(conn.id)!.needs_reauth).toBe(1);

      setConnectionNeedsReauth(conn.id, false);
      setConnectionNeedsReauth(conn.id, false);
      expect(getConnection(conn.id)!.needs_reauth).toBe(0);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('does not throw for nonexistent connection ID', () => {
    expect(() => setConnectionNeedsReauth('conn_nonexistent', true)).not.toThrow();
  });
});
