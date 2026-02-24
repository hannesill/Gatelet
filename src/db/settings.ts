import { getDb } from './database.js';
import { encryptString, decryptString } from './crypto.js';
import type { Provider } from '../providers/types.js';

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

// Generic OAuth credential accessors
// Priority: user-configured (DB) > env var > built-in (from provider)
export function getOAuthClientId(provider: Provider): string | undefined {
  if (!provider.oauth) return undefined;
  const { settingsKeyPrefix, envClientId, builtinClientId } = provider.oauth;
  return getSetting(`${settingsKeyPrefix}_client_id`)
    ?? process.env[envClientId]
    ?? builtinClientId
    ?? undefined;
}

export function getOAuthClientSecret(provider: Provider): string | undefined {
  if (!provider.oauth) return undefined;
  const { settingsKeyPrefix, envClientSecret, builtinClientSecret } = provider.oauth;
  return getSetting(`${settingsKeyPrefix}_client_secret`)
    ?? process.env[envClientSecret]
    ?? builtinClientSecret
    ?? undefined;
}

export function setOAuthCredentials(settingsKeyPrefix: string, clientId: string, clientSecret: string): void {
  setSetting(`${settingsKeyPrefix}_client_id`, clientId);
  setSetting(`${settingsKeyPrefix}_client_secret`, clientSecret);
}
