import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-crypto-test-${Date.now()}`);
process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'test-token';

import {
  deriveKeyFromToken,
  getMasterKey,
  resetMasterKey,
  encryptString,
  decryptString,
} from '../../src/db/crypto.js';

describe('Admin-token-derived master key (HKDF)', () => {
  beforeEach(() => {
    resetMasterKey();
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true, mode: 0o700 });
  });

  afterAll(() => {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('derives a consistent key for the same token', () => {
    deriveKeyFromToken('my-admin-token-abc123');
    const key1 = Buffer.from(getMasterKey());

    resetMasterKey();

    deriveKeyFromToken('my-admin-token-abc123');
    const key2 = Buffer.from(getMasterKey());

    expect(key1.equals(key2)).toBe(true);
  });

  it('derives different keys for different tokens', () => {
    deriveKeyFromToken('token-one');
    const key1 = Buffer.from(getMasterKey());

    resetMasterKey();

    deriveKeyFromToken('token-two');
    const key2 = Buffer.from(getMasterKey());

    expect(key1.equals(key2)).toBe(false);
  });

  it('getMasterKey throws if called before derivation', () => {
    resetMasterKey();
    expect(() => getMasterKey()).toThrow('Master key not initialized');
  });

  it('derives a 32-byte key', () => {
    deriveKeyFromToken('test-token');
    const key = getMasterKey();
    expect(key.length).toBe(32);
  });

  it('encryption roundtrip works with token-derived key', () => {
    deriveKeyFromToken('roundtrip-test-token');
    const original = 'sensitive data: {"access_token": "ya29.secret"}';
    const encrypted = encryptString(original);
    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(original);
  });

  it('does not create any files on disk (deterministic derivation)', () => {
    const filesBefore = fs.existsSync(TEST_DATA_DIR) ? fs.readdirSync(TEST_DATA_DIR) : [];
    deriveKeyFromToken('no-files-token');
    const filesAfter = fs.existsSync(TEST_DATA_DIR) ? fs.readdirSync(TEST_DATA_DIR) : [];
    expect(filesAfter.length).toBe(filesBefore.length);
  });
});
