/**
 * Tests for the audit log data layer (insertAuditEntry, queryAuditLog, countAuditLog).
 *
 * The audit log is critical for security observability -- every tool call
 * (allowed, denied, or errored) must be recorded with correct metadata.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-audit-test-${Date.now()}`);

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'test-token';

import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import {
  insertAuditEntry,
  queryAuditLog,
  countAuditLog,
} from '../../src/db/audit.js';

describe('Audit log', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true, mode: 0o700 });
    resetMasterKey();
    resetDb();
    initTestMasterKey();
    getDb();
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('insertAuditEntry records an allowed tool call', () => {
    const countBefore = countAuditLog();

    insertAuditEntry({
      connection_id: 'conn_test1',
      tool_name: 'calendar_list_events',
      original_params: { calendarId: 'primary' },
      mutated_params: { calendarId: 'primary' },
      result: 'allowed',
      response_summary: '{"events": []}',
      duration_ms: 42,
    });

    expect(countAuditLog()).toBe(countBefore + 1);
  });

  it('insertAuditEntry records a denied tool call with reason', () => {
    insertAuditEntry({
      connection_id: 'conn_test2',
      tool_name: 'calendar_create_event',
      original_params: { calendarId: 'other' },
      result: 'denied',
      deny_reason: 'Constraint violation: calendarId must_equal "primary"',
      duration_ms: 1,
    });

    const entries = queryAuditLog({ tool_name: 'calendar_create_event', result: 'denied' });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].deny_reason).toContain('must_equal');
  });

  it('insertAuditEntry records an error with minimal fields', () => {
    insertAuditEntry({
      tool_name: 'gmail_search',
      result: 'error',
      deny_reason: 'Connection not found',
    });

    const entries = queryAuditLog({ tool_name: 'gmail_search', result: 'error' });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const entry = entries[0];
    expect(entry.connection_id).toBeNull();
    expect(entry.original_params).toBeNull();
    expect(entry.mutated_params).toBeNull();
    expect(entry.duration_ms).toBeNull();
  });

  it('queryAuditLog returns entries in descending timestamp order', () => {
    // Insert entries with known tool names
    insertAuditEntry({ tool_name: 'order_test_1', result: 'allowed' });
    insertAuditEntry({ tool_name: 'order_test_2', result: 'allowed' });

    const entries = queryAuditLog({});
    // Most recent entry should be first
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const ts0 = new Date(entries[0].timestamp).getTime();
    const ts1 = new Date(entries[1].timestamp).getTime();
    expect(ts0).toBeGreaterThanOrEqual(ts1);
  });

  it('queryAuditLog filters by tool_name', () => {
    insertAuditEntry({ tool_name: 'unique_tool_filter_test', result: 'allowed' });

    const entries = queryAuditLog({ tool_name: 'unique_tool_filter_test' });
    expect(entries.length).toBe(1);
    expect(entries[0].tool_name).toBe('unique_tool_filter_test');
  });

  it('queryAuditLog filters by result', () => {
    insertAuditEntry({ tool_name: 'result_filter_a', result: 'allowed' });
    insertAuditEntry({ tool_name: 'result_filter_b', result: 'denied', deny_reason: 'nope' });

    const allowed = queryAuditLog({ tool_name: 'result_filter_a', result: 'allowed' });
    expect(allowed.length).toBe(1);

    const denied = queryAuditLog({ tool_name: 'result_filter_b', result: 'denied' });
    expect(denied.length).toBe(1);
  });

  it('queryAuditLog respects limit and offset for pagination', () => {
    for (let i = 0; i < 5; i++) {
      insertAuditEntry({ tool_name: `paginate_${i}`, result: 'allowed' });
    }

    const page1 = queryAuditLog({ limit: 2, offset: 0 });
    const page2 = queryAuditLog({ limit: 2, offset: 2 });
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    // Pages should not overlap
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it('countAuditLog filters by tool_name and result', () => {
    insertAuditEntry({ tool_name: 'count_test_tool', result: 'allowed' });
    insertAuditEntry({ tool_name: 'count_test_tool', result: 'denied', deny_reason: 'x' });
    insertAuditEntry({ tool_name: 'count_test_tool', result: 'allowed' });

    const total = countAuditLog({ tool_name: 'count_test_tool' });
    expect(total).toBe(3);

    const allowed = countAuditLog({ tool_name: 'count_test_tool', result: 'allowed' });
    expect(allowed).toBe(2);

    const denied = countAuditLog({ tool_name: 'count_test_tool', result: 'denied' });
    expect(denied).toBe(1);
  });

  it('original_params and mutated_params are stored as JSON strings', () => {
    const original = { calendarId: 'primary', summary: 'Test', nested: { deep: true } };
    const mutated = { calendarId: 'primary', summary: 'Test', visibility: 'private' };

    insertAuditEntry({
      tool_name: 'json_roundtrip',
      original_params: original,
      mutated_params: mutated,
      result: 'allowed',
    });

    const entries = queryAuditLog({ tool_name: 'json_roundtrip' });
    expect(entries.length).toBe(1);
    expect(JSON.parse(entries[0].original_params!)).toEqual(original);
    expect(JSON.parse(entries[0].mutated_params!)).toEqual(mutated);
  });
});
