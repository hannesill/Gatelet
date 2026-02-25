import sodium from 'sodium-native';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const ARGON2_OPSLIMIT = sodium.crypto_pwhash_OPSLIMIT_MODERATE;
const ARGON2_MEMLIMIT = sodium.crypto_pwhash_MEMLIMIT_MODERATE;
const ARGON2_ALG = sodium.crypto_pwhash_ALG_ARGON2ID13;
const SALT_BYTES = sodium.crypto_pwhash_SALTBYTES;

let masterKey: Buffer | null = null;

/**
 * Legacy: load or generate a master key from disk.
 * Only used during migration detection. After V0.5, getMasterKey() requires
 * the key to be initialized via deriveKeyFromPassphrase() first.
 */
function loadLegacyKey(): Buffer {
  const keyPath = path.join(config.DATA_DIR, 'master.key');

  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath);
    if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
      throw new Error('Invalid master key length');
    }
    return key;
  }

  // First run — generate key file (legacy mode, pre-V0.5)
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  sodium.randombytes_buf(key);
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

/**
 * Check if this installation needs migration (has master.key but no master.salt).
 */
export function needsMigration(): boolean {
  const keyPath = path.join(config.DATA_DIR, 'master.key');
  const saltPath = path.join(config.DATA_DIR, 'master.salt');
  return fs.existsSync(keyPath) && !fs.existsSync(saltPath);
}

/**
 * Check if this is a fresh installation (no master.key and no master.salt).
 */
export function isFreshInstall(): boolean {
  const keyPath = path.join(config.DATA_DIR, 'master.key');
  const saltPath = path.join(config.DATA_DIR, 'master.salt');
  return !fs.existsSync(keyPath) && !fs.existsSync(saltPath);
}

/**
 * Check if passphrase mode is active (master.salt exists).
 */
export function isPassphraseMode(): boolean {
  const saltPath = path.join(config.DATA_DIR, 'master.salt');
  return fs.existsSync(saltPath);
}

/**
 * Derive the master key from a passphrase using Argon2id.
 * Call once at startup before any encrypt/decrypt operations.
 */
export function deriveKeyFromPassphrase(passphrase: string): void {
  const saltPath = path.join(config.DATA_DIR, 'master.salt');

  let salt: Buffer;
  if (fs.existsSync(saltPath)) {
    salt = fs.readFileSync(saltPath);
    if (salt.length !== SALT_BYTES) {
      throw new Error(`Invalid salt file: expected ${SALT_BYTES} bytes, got ${salt.length}`);
    }
  } else {
    // First run with passphrase — generate salt
    salt = Buffer.alloc(SALT_BYTES);
    sodium.randombytes_buf(salt);
    fs.mkdirSync(path.dirname(saltPath), { recursive: true });
    fs.writeFileSync(saltPath, salt, { mode: 0o600 });
  }

  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  sodium.crypto_pwhash(
    key,
    Buffer.from(passphrase),
    salt,
    ARGON2_OPSLIMIT,
    ARGON2_MEMLIMIT,
    ARGON2_ALG,
  );

  masterKey = key;
}

/**
 * Verify the derived key can decrypt existing data.
 * Call after deriveKeyFromPassphrase() on existing installations.
 * Returns true if the key is correct, false if decryption fails.
 */
export function verifyMasterKey(): boolean {
  const verifierPath = path.join(config.DATA_DIR, 'master.verifier');

  if (!fs.existsSync(verifierPath)) {
    // First run — create verifier
    const verifier = encryptString('gatelet-key-verifier');
    fs.writeFileSync(verifierPath, verifier, { mode: 0o600 });
    return true;
  }

  try {
    const encrypted = fs.readFileSync(verifierPath);
    const decrypted = decryptString(encrypted);
    return decrypted === 'gatelet-key-verifier';
  } catch {
    return false;
  }
}

/**
 * Migrate from file-based master key to passphrase-derived key.
 * Re-encrypts all credentials and settings with the new key.
 */
export function migrateFromKeyFile(passphrase: string, db: import('better-sqlite3').Database): void {
  const keyPath = path.join(config.DATA_DIR, 'master.key');
  const oldKey = fs.readFileSync(keyPath);

  if (oldKey.length !== sodium.crypto_secretbox_KEYBYTES) {
    throw new Error('Invalid master.key file');
  }

  // Derive new key from passphrase
  deriveKeyFromPassphrase(passphrase);
  const newKey = getMasterKey();

  // Wrap all re-encryption in a transaction to prevent data corruption on crash
  const migrate = db.transaction(() => {
    const connections = db.prepare('SELECT id, credentials_encrypted FROM connections').all() as Array<{
      id: string;
      credentials_encrypted: Buffer;
    }>;

    for (const conn of connections) {
      // Decrypt with old key
      const nonce = conn.credentials_encrypted.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
      const ciphertext = conn.credentials_encrypted.subarray(sodium.crypto_secretbox_NONCEBYTES);
      const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);
      if (!sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, oldKey)) {
        throw new Error(`Failed to decrypt credentials for connection ${conn.id} with old key`);
      }

      // Re-encrypt with new key
      const newNonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
      sodium.randombytes_buf(newNonce);
      const newCiphertext = Buffer.alloc(plaintext.length + sodium.crypto_secretbox_MACBYTES);
      sodium.crypto_secretbox_easy(newCiphertext, plaintext, newNonce, newKey);
      const newEncrypted = Buffer.concat([newNonce, newCiphertext]);

      db.prepare('UPDATE connections SET credentials_encrypted = ? WHERE id = ?')
        .run(newEncrypted, conn.id);
    }

    // Re-encrypt settings
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

  // Create verifier with new key
  verifyMasterKey();

  // Backup old key file
  fs.renameSync(keyPath, keyPath + '.backup');
}

export function getMasterKey(): Buffer {
  if (!masterKey) {
    throw new Error(
      'Master key not initialized. Call deriveKeyFromPassphrase() or setMasterKeyForTesting() at startup.',
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
 * This bypasses passphrase derivation.
 */
export function setMasterKeyForTesting(key: Buffer): void {
  masterKey = key;
}

export function resetMasterKey(): void {
  masterKey = null;
}
