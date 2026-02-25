import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sodium from 'sodium-native';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-crypto-test-${Date.now()}`);
process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'test-token';

import {
  deriveKeyFromPassphrase,
  verifyMasterKey,
  getMasterKey,
  resetMasterKey,
  setMasterKeyForTesting,
  encryptString,
  decryptString,
} from '../../src/db/crypto.js';

describe('Passphrase-derived master key', () => {
  beforeEach(() => {
    resetMasterKey();
    // Clean up test files
    const saltPath = path.join(TEST_DATA_DIR, 'master.salt');
    const verifierPath = path.join(TEST_DATA_DIR, 'master.verifier');
    if (fs.existsSync(saltPath)) fs.unlinkSync(saltPath);
    if (fs.existsSync(verifierPath)) fs.unlinkSync(verifierPath);
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('derives a consistent key for same passphrase + salt', () => {
    deriveKeyFromPassphrase('test-passphrase-123');
    const key1 = Buffer.from(getMasterKey());

    // Reset in-memory key but keep salt file
    resetMasterKey();

    deriveKeyFromPassphrase('test-passphrase-123');
    const key2 = Buffer.from(getMasterKey());

    expect(key1.equals(key2)).toBe(true);
  });

  it('derives different keys for different passphrases', () => {
    deriveKeyFromPassphrase('passphrase-one');
    const key1 = Buffer.from(getMasterKey());

    // Reset and use a different passphrase with a different salt
    resetMasterKey();
    const saltPath = path.join(TEST_DATA_DIR, 'master.salt');
    fs.unlinkSync(saltPath);

    deriveKeyFromPassphrase('passphrase-two');
    const key2 = Buffer.from(getMasterKey());

    expect(key1.equals(key2)).toBe(false);
  });

  it('verifyMasterKey returns true with correct passphrase', () => {
    deriveKeyFromPassphrase('correct-passphrase');
    const verified = verifyMasterKey();
    expect(verified).toBe(true);

    // Verify again — should still work (reads existing verifier)
    resetMasterKey();
    deriveKeyFromPassphrase('correct-passphrase');
    expect(verifyMasterKey()).toBe(true);
  });

  it('verifyMasterKey returns false with wrong passphrase', () => {
    deriveKeyFromPassphrase('correct-passphrase');
    verifyMasterKey(); // Creates verifier

    // Reset and use wrong passphrase with a NEW salt
    resetMasterKey();
    const saltPath = path.join(TEST_DATA_DIR, 'master.salt');
    fs.unlinkSync(saltPath);

    deriveKeyFromPassphrase('wrong-passphrase');
    expect(verifyMasterKey()).toBe(false);
  });

  it('getMasterKey throws if called before derivation', () => {
    resetMasterKey();
    expect(() => getMasterKey()).toThrow('Master key not initialized');
  });

  it('creates salt file on first run, reuses on subsequent runs', () => {
    const saltPath = path.join(TEST_DATA_DIR, 'master.salt');
    expect(fs.existsSync(saltPath)).toBe(false);

    deriveKeyFromPassphrase('test');
    expect(fs.existsSync(saltPath)).toBe(true);

    const salt1 = fs.readFileSync(saltPath);
    resetMasterKey();

    deriveKeyFromPassphrase('test');
    const salt2 = fs.readFileSync(saltPath);

    expect(salt1.equals(salt2)).toBe(true);
  });

  it('salt file is 16 bytes with 0o600 permissions', () => {
    deriveKeyFromPassphrase('test');
    const saltPath = path.join(TEST_DATA_DIR, 'master.salt');
    const salt = fs.readFileSync(saltPath);
    expect(salt.length).toBe(16);

    const stat = fs.statSync(saltPath);
    expect((stat.mode & 0o777).toString(8)).toBe('600');
  });

  it('encryption roundtrip works with passphrase-derived key', () => {
    deriveKeyFromPassphrase('roundtrip-test-pass');
    const original = 'sensitive data: {"access_token": "ya29.secret"}';
    const encrypted = encryptString(original);
    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(original);
  });
});
