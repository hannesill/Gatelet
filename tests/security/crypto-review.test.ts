/**
 * Security Audit: Encryption Implementation Review
 *
 * Tests for FINDING-16 (key and encrypted data co-located in same directory),
 * and verifies the crypto implementation correctness.
 * Updated for admin-token-derived key (HKDF-SHA256).
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

import { getMasterKey, encrypt, decrypt, encryptString, decryptString, resetMasterKey, setMasterKeyForTesting } from '../../src/db/crypto.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';
import sodium from 'sodium-native';

describe('Encryption Implementation Review', () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true, mode: 0o700 });
    resetMasterKey();
    resetDb();
    // Use setMasterKeyForTesting instead of getMasterKey() which no longer auto-generates
    const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
    sodium.randombytes_buf(key);
    setMasterKeyForTesting(key);
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('Master key management', () => {
    it('getMasterKey returns a key of correct length', () => {
      const key = getMasterKey();
      // XSalsa20-Poly1305 requires a 32-byte key
      expect(key.length).toBe(32);
    });

    it('FINDING-04: master key is NO LONGER stored on disk (V0.5)', () => {
      const keyPath = path.join(TEST_DATA_DIR, 'master.key');

      // With admin-token-derived key, there should be no master.key file
      expect(fs.existsSync(keyPath)).toBe(false);
    });

    it('returns the same key on subsequent calls', () => {
      const key1 = getMasterKey();
      const key2 = getMasterKey();
      expect(key1.equals(key2)).toBe(true);
    });

    it('throws when key not initialized', () => {
      const key = getMasterKey(); // save current
      resetMasterKey();
      expect(() => getMasterKey()).toThrow('Master key not initialized');
      setMasterKeyForTesting(key); // restore
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
