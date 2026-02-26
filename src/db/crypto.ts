import sodium from 'sodium-native';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

let masterKey: Buffer | null = null;

/**
 * Derive the master key from the admin token using HKDF.
 * The admin token is already 32 bytes of randomness (hex-encoded),
 * so HKDF is the appropriate KDF (no password stretching needed).
 */
export function deriveKeyFromToken(token: string): void {
  const derived = crypto.hkdfSync(
    'sha256',
    token,
    'gatelet',
    'master-key',
    sodium.crypto_secretbox_KEYBYTES,
  );
  masterKey = Buffer.from(derived);
}

/**
 * Check if this installation needs migration from a previous key scheme.
 * Returns true if master.salt exists (passphrase mode) or master.key exists (legacy mode).
 */
export function needsMigration(): boolean {
  const keyPath = path.join(config.DATA_DIR, 'master.key');
  const saltPath = path.join(config.DATA_DIR, 'master.salt');
  return fs.existsSync(saltPath) || fs.existsSync(keyPath);
}

/**
 * Derive the old master key from a passphrase using Argon2id (migration only).
 */
function deriveKeyFromPassphrase(passphrase: string, saltPath: string): Buffer {
  const saltBytes = sodium.crypto_pwhash_SALTBYTES;
  const salt = fs.readFileSync(saltPath);
  if (salt.length !== saltBytes) {
    throw new Error(`Invalid salt file: expected ${saltBytes} bytes, got ${salt.length}`);
  }

  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  sodium.crypto_pwhash(
    key,
    Buffer.from(passphrase),
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  return key;
}

/**
 * Re-encrypt all rows from oldKey to newKey within a transaction.
 */
function reEncryptAll(oldKey: Buffer, newKey: Buffer, db: import('better-sqlite3').Database): void {
  const migrate = db.transaction(() => {
    const connections = db.prepare('SELECT id, credentials_encrypted FROM connections').all() as Array<{
      id: string;
      credentials_encrypted: Buffer;
    }>;

    for (const conn of connections) {
      const nonce = conn.credentials_encrypted.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
      const ciphertext = conn.credentials_encrypted.subarray(sodium.crypto_secretbox_NONCEBYTES);
      const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);
      if (!sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, oldKey)) {
        throw new Error(`Failed to decrypt credentials for connection ${conn.id} with old key`);
      }

      const newNonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
      sodium.randombytes_buf(newNonce);
      const newCiphertext = Buffer.alloc(plaintext.length + sodium.crypto_secretbox_MACBYTES);
      sodium.crypto_secretbox_easy(newCiphertext, plaintext, newNonce, newKey);
      const newEncrypted = Buffer.concat([newNonce, newCiphertext]);

      db.prepare('UPDATE connections SET credentials_encrypted = ? WHERE id = ?')
        .run(newEncrypted, conn.id);
    }

    const settings = db.prepare('SELECT key, value_encrypted FROM settings').all() as Array<{
      key: string;
      value_encrypted: Buffer;
    }>;

    for (const setting of settings) {
      const sNonce = setting.value_encrypted.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
      const sCiphertext = setting.value_encrypted.subarray(sodium.crypto_secretbox_NONCEBYTES);
      const sPlaintext = Buffer.alloc(sCiphertext.length - sodium.crypto_secretbox_MACBYTES);
      if (!sodium.crypto_secretbox_open_easy(sPlaintext, sCiphertext, sNonce, oldKey)) {
        throw new Error(`Failed to decrypt setting "${setting.key}" with old key`);
      }

      const sNewNonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
      sodium.randombytes_buf(sNewNonce);
      const sNewCiphertext = Buffer.alloc(sPlaintext.length + sodium.crypto_secretbox_MACBYTES);
      sodium.crypto_secretbox_easy(sNewCiphertext, sPlaintext, sNewNonce, newKey);
      const sNewEncrypted = Buffer.concat([sNewNonce, sNewCiphertext]);

      db.prepare('UPDATE settings SET value_encrypted = ? WHERE key = ?')
        .run(sNewEncrypted, setting.key);
    }
  });
  migrate();
}

/**
 * Migrate from passphrase-based encryption to admin-token-derived key.
 * Reads old passphrase, derives old key via Argon2id, derives new key via HKDF,
 * re-encrypts all rows, then cleans up legacy files.
 */
export function migrateFromPassphrase(passphrase: string, adminToken: string, db: import('better-sqlite3').Database): void {
  const saltPath = path.join(config.DATA_DIR, 'master.salt');
  const oldKey = deriveKeyFromPassphrase(passphrase, saltPath);

  // Derive new key from admin token
  deriveKeyFromToken(adminToken);
  const newKey = getMasterKey();

  reEncryptAll(oldKey, newKey, db);

  // Clean up legacy files
  fs.unlinkSync(saltPath);
  const verifierPath = path.join(config.DATA_DIR, 'master.verifier');
  if (fs.existsSync(verifierPath)) fs.unlinkSync(verifierPath);
}

/**
 * Migrate from legacy master.key file to admin-token-derived key.
 * Reads old key from disk, derives new key via HKDF, re-encrypts all rows,
 * then backs up the old key file.
 */
export function migrateFromKeyFile(adminToken: string, db: import('better-sqlite3').Database): void {
  const keyPath = path.join(config.DATA_DIR, 'master.key');
  const oldKey = fs.readFileSync(keyPath);

  if (oldKey.length !== sodium.crypto_secretbox_KEYBYTES) {
    throw new Error('Invalid master.key file');
  }

  // Derive new key from admin token
  deriveKeyFromToken(adminToken);
  const newKey = getMasterKey();

  reEncryptAll(oldKey, newKey, db);

  // Backup old key file
  fs.renameSync(keyPath, keyPath + '.backup');

  // Clean up verifier if it exists
  const verifierPath = path.join(config.DATA_DIR, 'master.verifier');
  if (fs.existsSync(verifierPath)) fs.unlinkSync(verifierPath);
}

export function getMasterKey(): Buffer {
  if (!masterKey) {
    throw new Error(
      'Master key not initialized. Call deriveKeyFromToken() or setMasterKeyForTesting() at startup.',
    );
  }
  return masterKey;
}

export function encrypt(plaintext: Buffer): Buffer {
  const key = getMasterKey();
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
  sodium.randombytes_buf(nonce);
  const ciphertext = Buffer.alloc(plaintext.length + sodium.crypto_secretbox_MACBYTES);
  sodium.crypto_secretbox_easy(ciphertext, plaintext, nonce, key);
  return Buffer.concat([nonce, ciphertext]);
}

export function decrypt(encrypted: Buffer): Buffer {
  const key = getMasterKey();
  const nonce = encrypted.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = encrypted.subarray(sodium.crypto_secretbox_NONCEBYTES);
  const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);
  if (!sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, key)) {
    throw new Error('Decryption failed');
  }
  return plaintext;
}

export function encryptString(value: string): Buffer {
  return encrypt(Buffer.from(value, 'utf-8'));
}

export function decryptString(encrypted: Buffer): string {
  return decrypt(encrypted).toString('utf-8');
}

/**
 * Set the master key directly (for testing only).
 * This bypasses token derivation.
 */
export function setMasterKeyForTesting(key: Buffer): void {
  masterKey = key;
}

export function resetMasterKey(): void {
  masterKey = null;
}
