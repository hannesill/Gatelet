import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

let db: Database.Database | null = null;

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    credentials_encrypted BLOB NOT NULL,
    policy_yaml TEXT NOT NULL,
    settings_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    api_key_id TEXT,
    connection_id TEXT,
    tool_name TEXT NOT NULL,
    original_params TEXT,
    mutated_params TEXT,
    result TEXT NOT NULL,
    deny_reason TEXT,
    response_summary TEXT,
    duration_ms INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_tool_name ON audit_log(tool_name)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_result ON audit_log(result)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_encrypted BLOB NOT NULL
  )`,
];

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(config.DATA_DIR, { recursive: true });

  const dbPath = path.join(config.DATA_DIR, 'gatelet.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  for (const migration of MIGRATIONS) {
    db.exec(migration);
  }

  // Schema migrations for existing databases
  try {
    db.exec(`ALTER TABLE connections ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'`);
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE connections ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // Column already exists
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function resetDb(): void {
  closeDb();
}
