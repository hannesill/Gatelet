import sodium from 'sodium-native';
import { resetMasterKey, setMasterKeyForTesting } from '../../src/db/crypto.js';

/**
 * Initialize a random master key for testing.
 * Call this in beforeAll after resetMasterKey().
 */
export function initTestMasterKey(): void {
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  sodium.randombytes_buf(key);
  setMasterKeyForTesting(key);
}

export { resetMasterKey };
