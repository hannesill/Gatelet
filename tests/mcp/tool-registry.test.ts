import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-registry-test-${Date.now()}`);

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'registry-test-token';
process.env.GATELET_MCP_PORT = '20000';
process.env.GATELET_ADMIN_PORT = '20001';

import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import { createConnection, deleteConnection } from '../../src/db/connections.js';
import { buildToolRegistry } from '../../src/mcp/tool-registry.js';

describe('buildToolRegistry', () => {
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

  it('returns empty registry when no connections exist', () => {
    const registry = buildToolRegistry();
    expect(registry.size).toBe(0);
  });

  it('registers only tools with allow: true in the policy', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'registry-test@gmail.com',
      credentials: { access_token: 'tok', refresh_token: 'ref' },
      policy_yaml: `provider: google_calendar
account: registry-test@gmail.com
operations:
  list_calendars:
    allow: true
  list_events:
    allow: true
  create_event:
    allow: false
  update_event:
    allow: false`,
    });

    try {
      const registry = buildToolRegistry();
      // Only list_calendars and list_events should be registered
      expect(registry.has('calendar_list_calendars')).toBe(true);
      expect(registry.has('calendar_list_events')).toBe(true);
      // Denied tools must NOT appear -- agents must never see them
      expect(registry.has('calendar_create_event')).toBe(false);
      expect(registry.has('calendar_update_event')).toBe(false);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('denied tools are invisible -- not registered at all', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'hidden-tools@gmail.com',
      credentials: { access_token: 'tok', refresh_token: 'ref' },
      policy_yaml: `provider: google_calendar
account: hidden-tools@gmail.com
operations:
  list_calendars:
    allow: false
  list_events:
    allow: false
  create_event:
    allow: false
  update_event:
    allow: false`,
    });

    try {
      const registry = buildToolRegistry();
      // With all operations denied, zero tools from this connection
      for (const [name, tool] of registry) {
        expect(tool.connectionId).not.toBe(conn.id);
      }
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('operations not mentioned in policy are not registered', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'partial-policy@gmail.com',
      credentials: { access_token: 'tok', refresh_token: 'ref' },
      // Only list_calendars is mentioned -- everything else is denied by default
      policy_yaml: `provider: google_calendar
account: partial-policy@gmail.com
operations:
  list_calendars:
    allow: true`,
    });

    try {
      const registry = buildToolRegistry();
      expect(registry.has('calendar_list_calendars')).toBe(true);
      // Not mentioned = denied by default
      expect(registry.has('calendar_list_events')).toBe(false);
      expect(registry.has('calendar_create_event')).toBe(false);
      expect(registry.has('calendar_update_event')).toBe(false);
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('skips connections with invalid policy YAML', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'bad-yaml@gmail.com',
      credentials: { access_token: 'tok', refresh_token: 'ref' },
      policy_yaml: 'this is not valid yaml: [',
    });

    try {
      // Should not throw -- just skip the bad connection
      const registry = buildToolRegistry();
      for (const [, tool] of registry) {
        expect(tool.connectionId).not.toBe(conn.id);
      }
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('skips connections with unknown provider', () => {
    const conn = createConnection({
      provider_id: 'nonexistent_provider',
      account_name: 'unknown@gmail.com',
      credentials: { access_token: 'tok', refresh_token: 'ref' },
      policy_yaml: `provider: nonexistent_provider
account: unknown@gmail.com
operations:
  some_op:
    allow: true`,
    });

    try {
      const registry = buildToolRegistry();
      for (const [, tool] of registry) {
        expect(tool.connectionId).not.toBe(conn.id);
      }
    } finally {
      deleteConnection(conn.id);
    }
  });

  it('registered tool has correct metadata', () => {
    const conn = createConnection({
      provider_id: 'google_calendar',
      account_name: 'metadata-test@gmail.com',
      credentials: { access_token: 'tok', refresh_token: 'ref' },
      policy_yaml: `provider: google_calendar
account: metadata-test@gmail.com
operations:
  list_events:
    allow: true`,
    });

    try {
      const registry = buildToolRegistry();
      const tool = registry.get('calendar_list_events');
      expect(tool).toBeDefined();
      expect(tool!.connectionId).toBe(conn.id);
      expect(tool!.providerId).toBe('google_calendar');
      expect(tool!.policyOperation).toBe('list_events');
      expect(tool!.tool.name).toBe('calendar_list_events');
      expect(tool!.tool.description).toBeTruthy();
      expect(tool!.tool.inputSchema).toBeDefined();
    } finally {
      deleteConnection(conn.id);
    }
  });
});
