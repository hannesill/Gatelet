import { nanoid } from 'nanoid';
import { getDb } from './database.js';
import { encryptString, decryptString } from './crypto.js';

export interface Connection {
  id: string;
  provider_id: string;
  account_name: string;
  policy_yaml: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectionWithCredentials extends Connection {
  credentials: Record<string, unknown>;
}

interface ConnectionRow {
  id: string;
  provider_id: string;
  account_name: string;
  credentials_encrypted: Buffer;
  policy_yaml: string;
  created_at: string;
  updated_at: string;
}

export function listConnections(): Connection[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, provider_id, account_name, policy_yaml, created_at, updated_at FROM connections',
    )
    .all() as Connection[];
  return rows;
}

export function getConnection(id: string): Connection | undefined {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, provider_id, account_name, policy_yaml, created_at, updated_at FROM connections WHERE id = ?',
    )
    .get(id) as Connection | undefined;
}

export function getConnectionWithCredentials(
  id: string,
): ConnectionWithCredentials | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM connections WHERE id = ?')
    .get(id) as ConnectionRow | undefined;

  if (!row) return undefined;

  const credentials = JSON.parse(decryptString(row.credentials_encrypted));
  return {
    id: row.id,
    provider_id: row.provider_id,
    account_name: row.account_name,
    policy_yaml: row.policy_yaml,
    created_at: row.created_at,
    updated_at: row.updated_at,
    credentials,
  };
}

export function createConnection(params: {
  provider_id: string;
  account_name: string;
  credentials: Record<string, unknown>;
  policy_yaml: string;
}): Connection {
  const db = getDb();
  const id = `conn_${nanoid()}`;
  const encrypted = encryptString(JSON.stringify(params.credentials));

  db.prepare(
    'INSERT INTO connections (id, provider_id, account_name, credentials_encrypted, policy_yaml) VALUES (?, ?, ?, ?, ?)',
  ).run(id, params.provider_id, params.account_name, encrypted, params.policy_yaml);

  return getConnection(id)!;
}

export function updateConnectionCredentials(
  id: string,
  credentials: Record<string, unknown>,
): void {
  const db = getDb();
  const encrypted = encryptString(JSON.stringify(credentials));
  db.prepare(
    "UPDATE connections SET credentials_encrypted = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(encrypted, id);
}

export function updateConnectionPolicy(id: string, policyYaml: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE connections SET policy_yaml = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(policyYaml, id);
}

export function deleteConnection(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  return result.changes > 0;
}
