import { getDb } from './database.js';

export interface AuditEntry {
  id: number;
  timestamp: string;
  api_key_id: string | null;
  connection_id: string | null;
  tool_name: string;
  original_params: string | null;
  mutated_params: string | null;
  result: 'allowed' | 'denied' | 'error';
  deny_reason: string | null;
  response_summary: string | null;
  duration_ms: number | null;
}

export function insertAuditEntry(entry: {
  api_key_id?: string;
  connection_id?: string;
  tool_name: string;
  original_params?: Record<string, unknown>;
  mutated_params?: Record<string, unknown> | null;
  result: 'allowed' | 'denied' | 'error';
  deny_reason?: string;
  response_summary?: string;
  duration_ms?: number;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (api_key_id, connection_id, tool_name, original_params, mutated_params, result, deny_reason, response_summary, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.api_key_id ?? null,
    entry.connection_id ?? null,
    entry.tool_name,
    entry.original_params ? JSON.stringify(entry.original_params) : null,
    entry.mutated_params ? JSON.stringify(entry.mutated_params) : null,
    entry.result,
    entry.deny_reason ?? null,
    entry.response_summary ?? null,
    entry.duration_ms ?? null,
  );
}

export function countAuditLog(filters?: {
  tool_name?: string;
  result?: string;
  from?: string;
  to?: string;
}): number {
  const db = getDb();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters?.tool_name) {
    conditions.push('tool_name = ?');
    values.push(filters.tool_name);
  }
  if (filters?.result) {
    conditions.push('result = ?');
    values.push(filters.result);
  }
  if (filters?.from) {
    conditions.push('timestamp >= ?');
    values.push(filters.from);
  }
  if (filters?.to) {
    conditions.push('timestamp <= ?');
    values.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(...values) as { count: number };
  return row.count;
}

export function queryAuditLog(filters: {
  limit?: number;
  offset?: number;
  tool_name?: string;
  result?: string;
  from?: string;
  to?: string;
}): AuditEntry[] {
  const db = getDb();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.tool_name) {
    conditions.push('tool_name = ?');
    values.push(filters.tool_name);
  }
  if (filters.result) {
    conditions.push('result = ?');
    values.push(filters.result);
  }
  if (filters.from) {
    conditions.push('timestamp >= ?');
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push('timestamp <= ?');
    values.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  return db
    .prepare(
      `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    )
    .all(...values, limit, offset) as AuditEntry[];
}
