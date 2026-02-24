import { getDb } from './database.js';
import { encryptString, decryptString } from './crypto.js';

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare('SELECT value_encrypted FROM settings WHERE key = ?')
    .get(key) as { value_encrypted: Buffer } | undefined;
  if (!row) return null;
  return decryptString(row.value_encrypted);
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const encrypted = encryptString(value);
  db.prepare(
    'INSERT INTO settings (key, value_encrypted) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_encrypted = excluded.value_encrypted',
  ).run(key, encrypted);
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// Built-in Google OAuth credentials (Gatelet project)
const BUILTIN_GOOGLE_CLIENT_ID = '1096469986430-ap9lls3vhlu25v87ae3c8i8s3dhgaaiu.apps.googleusercontent.com';
const BUILTIN_GOOGLE_CLIENT_SECRET = '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';

// Convenience accessors for Google OAuth
// Priority: user-configured (DB) > env var > built-in
export function getGoogleClientId(): string | undefined {
  return getSetting('google_client_id') ?? process.env.GOOGLE_CLIENT_ID ?? BUILTIN_GOOGLE_CLIENT_ID;
}

export function getGoogleClientSecret(): string | undefined {
  return getSetting('google_client_secret') ?? process.env.GOOGLE_CLIENT_SECRET ?? BUILTIN_GOOGLE_CLIENT_SECRET;
}

export function setGoogleCredentials(clientId: string, clientSecret: string): void {
  setSetting('google_client_id', clientId);
  setSetting('google_client_secret', clientSecret);
}
