/**
 * Tests for connection enable/disable toggling and its effect on the tool registry.
 *
 * When a connection is disabled (enabled=0), its tools must not appear in the
 * MCP tool registry. This is a security boundary -- disabled connections should
 * be completely invisible to agents.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-toggle-test-${Date.now()}`);

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'toggle-test-token';
process.env.GATELET_MCP_PORT = '20100';
process.env.GATELET_ADMIN_PORT = '20101';

import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import {
  createConnection,
  getConnection,
  toggleConnectionEnabled,
  deleteConnection,
} from '../../src/db/connections.js';
import { buildToolRegistry } from '../../src/mcp/tool-registry.js';

const POLICY = `provider: google_calendar
account: toggle-test@gmail.com
operations:
  list_calendars:
    allow: true
  list_events:
    allow: true`;

describe('Connection enable/disable toggle', () => {
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

  it('new connections default to enabled', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'toggle-default@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: POLICY,
    });

    try {
      expect(conn.enabled).toBe(1);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('toggleConnectionEnabled disables a connection', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'toggle-disable@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: POLICY,
    });

    try {
      const changed = toggleConnectionEnabled(conn.id, false);
      expect(changed).toBe(true);

      const updated = getConnection(conn.id);
      expect(updated!.enabled).toBe(0);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('toggleConnectionEnabled re-enables a connection', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'toggle-reenable@gmail.com',
      credentials: { access_token: 'tok' },
      policy_yaml: POLICY,
    });

    try {
      toggleConnectionEnabled(conn.id, false);
      expect(getConnection(conn.id)!.enabled).toBe(0);

      toggleConnectionEnabled(conn.id, true);
      expect(getConnection(conn.id)!.enabled).toBe(1);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('toggleConnectionEnabled returns false for nonexistent connection', () => {
    const changed = toggleConnectionEnabled('conn_nonexistent', false);
    expect(changed).toBe(false);
  });

  it('disabled connections are excluded from tool registry', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'toggle-registry@gmail.com',
      credentials: { access_token: 'tok', refresh_token: 'ref' },
      policy_yaml: POLICY,
    });

    try {
      // Enabled: tools should be in registry
      const registryEnabled = buildToolRegistry();
      const hasTools = Array.from(registryEnabled.values()).some(
        (t) => t.connectionId === conn.id,
      );
      expect(hasTools).toBe(true);

      // Disable: tools should disappear
      toggleConnectionEnabled(conn.id, false);
      const registryDisabled = buildToolRegistry();
      const hasToolsAfter = Array.from(registryDisabled.values()).some(
        (t) => t.connectionId === conn.id,
      );
      expect(hasToolsAfter).toBe(false);

      // Re-enable: tools should come back
      toggleConnectionEnabled(conn.id, true);
      const registryReEnabled = buildToolRegistry();
      const hasToolsFinal = Array.from(registryReEnabled.values()).some(
        (t) => t.connectionId === conn.id,
      );
      expect(hasToolsFinal).toBe(true);
    } finally {
      deleteConnection(conn.id);
    }
  });
});
