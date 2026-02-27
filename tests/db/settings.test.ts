/**
 * Tests for the encrypted settings store and OAuth credential resolution.
 *
 * The settings store encrypts all values at rest. OAuth credential resolution
 * follows a priority chain: user-configured (DB) > env var > builtin.
 * Getting this wrong could silently use the wrong credentials.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-settings-test-${Date.now()}`);

process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'test-token';

import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import { initTestMasterKey, resetMasterKey } from '../helpers/setup-crypto.js';
import {
  getSetting,
  setSetting,
  deleteSetting,
  getOAuthClientId,
  getOAuthClientSecret,
  getOAuthCredentialSource,
  setOAuthCredentials,
} from '../../src/db/settings.js';
import type { Provider, OAuthConfig } from '../../src/providers/types.js';

describe('Encrypted settings store', () => {
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

  it('getSetting returns null for nonexistent key', () => {
    expect(getSetting('nonexistent_key')).toBeNull();
  });

  it('setSetting and getSetting roundtrip correctly', () => {
    setSetting('test_key', 'test_value');
    expect(getSetting('test_key')).toBe('test_value');
  });

  it('setSetting overwrites existing value (upsert)', () => {
    setSetting('overwrite_key', 'first');
    expect(getSetting('overwrite_key')).toBe('first');

    setSetting('overwrite_key', 'second');
    expect(getSetting('overwrite_key')).toBe('second');
  });

  it('deleteSetting removes the key', () => {
    setSetting('delete_me', 'value');
    expect(getSetting('delete_me')).toBe('value');

    deleteSetting('delete_me');
    expect(getSetting('delete_me')).toBeNull();
  });

  it('deleteSetting on nonexistent key does not throw', () => {
    expect(() => deleteSetting('never_existed')).not.toThrow();
  });

  it('values are encrypted at rest in the database', () => {
    const secretValue = 'super-secret-oauth-token';
    setSetting('encrypted_check', secretValue);

    const db = getDb();
    const row = db
      .prepare('SELECT value_encrypted FROM settings WHERE key = ?')
      .get('encrypted_check') as { value_encrypted: Buffer } | undefined;

    expect(row).toBeDefined();
    // The raw encrypted bytes should not contain the plaintext
    const rawBytes = row!.value_encrypted.toString('utf-8');
    expect(rawBytes).not.toBe(secretValue);
    expect(rawBytes).not.toContain(secretValue);
  });

  it('handles special characters and unicode in values', () => {
    const specialValue = 'p8O8Q~h9Rah3nGUil6.6aQJAaDyDSG07XcvYPb97';
    setSetting('special_chars', specialValue);
    expect(getSetting('special_chars')).toBe(specialValue);

    const unicodeValue = 'value with emoji \u{1F512} and accents: e\u0301';
    setSetting('unicode', unicodeValue);
    expect(getSetting('unicode')).toBe(unicodeValue);
  });
});

describe('OAuth credential resolution', () => {
  const envBackup: Record<string, string | undefined> = {};

  function setEnv(key: string, value: string | undefined) {
    if (!(key in envBackup)) envBackup[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  afterEach(() => {
    for (const [key, val] of Object.entries(envBackup)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    // Clean up DB settings
    try {
      deleteSetting('test_prefix_client_id');
      deleteSetting('test_prefix_client_secret');
    } catch { /* ignore */ }
  });

  const mockProvider: Provider = {
    id: 'test_provider',
    displayName: 'Test Provider',
    tools: [],
    oauth: {
      authorizeUrl: 'https://auth.example.com',
      tokenUrl: 'https://token.example.com',
      scopes: ['scope1'],
      builtinClientId: 'builtin-id',
      builtinClientSecret: 'builtin-secret',
      envClientId: 'TEST_OAUTH_CLIENT_ID',
      envClientSecret: 'TEST_OAUTH_CLIENT_SECRET',
      settingsKeyPrefix: 'test_prefix',
    },
    execute: async () => ({}),
  };

  const noOAuthProvider: Provider = {
    id: 'no_oauth',
    displayName: 'No OAuth',
    tools: [],
    execute: async () => ({}),
  };

  it('returns undefined for provider without OAuth config', () => {
    expect(getOAuthClientId(noOAuthProvider)).toBeUndefined();
    expect(getOAuthClientSecret(noOAuthProvider)).toBeUndefined();
  });

  it('returns "none" source for provider without OAuth config', () => {
    expect(getOAuthCredentialSource(noOAuthProvider)).toBe('none');
  });

  it('falls back to builtin credentials when nothing else is configured', () => {
    setEnv('TEST_OAUTH_CLIENT_ID', undefined);
    setEnv('TEST_OAUTH_CLIENT_SECRET', undefined);

    expect(getOAuthClientId(mockProvider)).toBe('builtin-id');
    expect(getOAuthClientSecret(mockProvider)).toBe('builtin-secret');
    expect(getOAuthCredentialSource(mockProvider)).toBe('builtin');
  });

  it('prefers env vars over builtin credentials', () => {
    setEnv('TEST_OAUTH_CLIENT_ID', 'env-id');
    setEnv('TEST_OAUTH_CLIENT_SECRET', 'env-secret');

    expect(getOAuthClientId(mockProvider)).toBe('env-id');
    expect(getOAuthClientSecret(mockProvider)).toBe('env-secret');
    expect(getOAuthCredentialSource(mockProvider)).toBe('env');
  });

  it('prefers DB-stored credentials over env and builtin', () => {
    setEnv('TEST_OAUTH_CLIENT_ID', 'env-id');
    setEnv('TEST_OAUTH_CLIENT_SECRET', 'env-secret');

    setOAuthCredentials('test_prefix', 'db-id', 'db-secret');

    expect(getOAuthClientId(mockProvider)).toBe('db-id');
    expect(getOAuthClientSecret(mockProvider)).toBe('db-secret');
    expect(getOAuthCredentialSource(mockProvider)).toBe('user');
  });

  it('setOAuthCredentials stores both client_id and client_secret', () => {
    setOAuthCredentials('test_prefix', 'my-id', 'my-secret');

    expect(getSetting('test_prefix_client_id')).toBe('my-id');
    expect(getSetting('test_prefix_client_secret')).toBe('my-secret');
  });

  it('returns "none" when builtin credentials are not provided and nothing else configured', () => {
    setEnv('TEST_OAUTH_CLIENT_ID', undefined);
    setEnv('TEST_OAUTH_CLIENT_SECRET', undefined);

    const providerNoBuitin: Provider = {
      ...mockProvider,
      oauth: {
        ...(mockProvider.oauth as OAuthConfig),
        builtinClientId: undefined,
        builtinClientSecret: undefined,
      },
    };

    expect(getOAuthClientId(providerNoBuitin)).toBeUndefined();
    expect(getOAuthClientSecret(providerNoBuitin)).toBeUndefined();
    expect(getOAuthCredentialSource(providerNoBuitin)).toBe('none');
  });
});
