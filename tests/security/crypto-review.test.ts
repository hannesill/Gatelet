/**
 * Security Audit: Encryption Implementation Review
 *
 * Tests for FINDING-16 (key and encrypted data co-located in same directory),
 * and verifies the crypto implementation correctness.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-sec-crypto-${Date.now()}`);
process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
process.env.GATELET_ADMIN_TOKEN = 'test-token';
process.env.GATELET_MCP_PORT = '18000';
process.env.GATELET_ADMIN_PORT = '18001';

import { getMasterKey, encrypt, decrypt, encryptString, decryptString, resetMasterKey } from '../../src/db/crypto.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';

describe('Encryption Implementation Review', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    resetMasterKey();
    resetDb();
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('Master key generation and storage', () => {
    it('generates a master key of correct length', () => {
      const key = getMasterKey();
      // XSalsa20-Poly1305 requires a 32-byte key
      expect(key.length).toBe(32);
    });

    it('FINDING-16: master key is stored in same directory as database', () => {
      const keyPath = path.join(TEST_DATA_DIR, 'master.key');
      const dbPath = path.join(TEST_DATA_DIR, 'gatelet.db');

      // Initialize the database
      getDb();

      // Both files exist in the same directory
      expect(fs.existsSync(keyPath)).toBe(true);

      // VULNERABILITY: If an attacker can read the data directory,
      // they get BOTH the encrypted database AND the decryption key.
      // This defeats the purpose of encryption.
      //
      // In the Docker threat model:
      //   - master.key is at /data/master.key
      //   - gatelet.db is at /data/gatelet.db
      //   - Both are in the same Docker volume
      //
      // If an agent can access the Docker volume (e.g., via docker cp,
      // or if the volume is bind-mounted), they get everything needed
      // to decrypt all OAuth tokens.
    });

    it('master key file has restricted permissions (0o600)', () => {
      const keyPath = path.join(TEST_DATA_DIR, 'master.key');
      const stats = fs.statSync(keyPath);
      const mode = (stats.mode & 0o777).toString(8);

      // Should be owner-only read/write
      expect(mode).toBe('600');
    });

    it('returns the same key on subsequent calls', () => {
      const key1 = getMasterKey();
      const key2 = getMasterKey();
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('Encryption correctness', () => {
    it('encrypt/decrypt roundtrip works', () => {
      const plaintext = Buffer.from('sensitive oauth token data');
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted.equals(plaintext)).toBe(true);
    });

    it('encryptString/decryptString roundtrip works', () => {
      const original = JSON.stringify({
        access_token: 'ya29.secret',
        refresh_token: '1//0eSecret',
      });
      const encrypted = encryptString(original);
      const decrypted = decryptString(encrypted);
      expect(decrypted).toBe(original);
    });

    it('each encryption produces a different ciphertext (unique nonces)', () => {
      const plaintext = Buffer.from('same data');
      const enc1 = encrypt(plaintext);
      const enc2 = encrypt(plaintext);

      // Nonces should be different
      expect(enc1.equals(enc2)).toBe(false);

      // But both should decrypt to the same plaintext
      expect(decrypt(enc1).equals(plaintext)).toBe(true);
      expect(decrypt(enc2).equals(plaintext)).toBe(true);
    });

    it('tampered ciphertext is rejected', () => {
      const plaintext = Buffer.from('original data');
      const encrypted = encrypt(plaintext);

      // Tamper with a byte in the ciphertext (after the nonce)
      const tampered = Buffer.from(encrypted);
      tampered[tampered.length - 1] ^= 0xff;

      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });

    it('truncated ciphertext is rejected', () => {
      const plaintext = Buffer.from('original data');
      const encrypted = encrypt(plaintext);

      const truncated = encrypted.subarray(0, encrypted.length - 5);
      expect(() => decrypt(truncated)).toThrow();
    });
  });

  describe('Crypto algorithm properties', () => {
    it('uses XSalsa20-Poly1305 (24-byte nonce)', () => {
      const plaintext = Buffer.from('test');
      const encrypted = encrypt(plaintext);

      // XSalsa20-Poly1305 nonce is 24 bytes
      // MAC is 16 bytes
      // So encrypted = nonce(24) + ciphertext(len + 16)
      const expectedLen = 24 + plaintext.length + 16;
      expect(encrypted.length).toBe(expectedLen);
    });
  });
});
