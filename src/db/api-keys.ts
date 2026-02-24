import { nanoid } from 'nanoid';
import crypto from 'node:crypto';
import { getDb } from './database.js';

export interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function listApiKeys(): ApiKey[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, name, created_at, last_used_at, revoked_at FROM api_keys',
    )
    .all() as ApiKey[];
}

export function createApiKey(name: string): { id: string; key: string } {
  const db = getDb();
  const id = `gl_${nanoid()}`;
  const rawKey = `glk_${nanoid(32)}`;
  const keyHash = hashKey(rawKey);

  db.prepare('INSERT INTO api_keys (id, name, key_hash) VALUES (?, ?, ?)').run(
    id,
    name,
    keyHash,
  );

  return { id, key: rawKey };
}

export function validateApiKey(
  rawKey: string,
): { id: string; name: string } | null {
  const db = getDb();
  const keyHash = hashKey(rawKey);
  const row = db
    .prepare(
      'SELECT id, name FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL',
    )
    .get(keyHash) as { id: string; name: string } | undefined;

  if (!row) return null;

  db.prepare(
    "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?",
  ).run(row.id);

  return row;
}

export function revokeApiKey(id: string): boolean {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL",
    )
    .run(id);
  return result.changes > 0;
}
