import sodium from 'sodium-native';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

let masterKey: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (masterKey) return masterKey;

  const keyPath = path.join(config.DATA_DIR, 'master.key');

  if (fs.existsSync(keyPath)) {
    masterKey = fs.readFileSync(keyPath);
    if (masterKey.length !== sodium.crypto_secretbox_KEYBYTES) {
      throw new Error('Invalid master key length');
    }
    return masterKey;
  }

  masterKey = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  sodium.randombytes_buf(masterKey);
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, masterKey, { mode: 0o600 });
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

export function resetMasterKey(): void {
  masterKey = null;
}
