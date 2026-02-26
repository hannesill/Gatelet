import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import sodium from 'sodium-native';
import { resetMasterKey, setMasterKeyForTesting } from '../../src/db/crypto.js';
import { getDb, closeDb, resetDb } from '../../src/db/database.js';

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

/**
 * Find a free TCP port by binding to port 0 and reading the assigned port.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.once('error', reject);
  });
}

/**
 * Create a temporary data directory and configure env vars for a test file.
 * Returns setup/teardown callbacks for beforeAll/afterAll.
 */
export function createTestEnvironment(name: string): {
  dataDir: string;
  setup: () => void;
  teardown: () => void;
} {
  const dataDir = path.join(os.tmpdir(), `gatelet-${name}-${Date.now()}`);

  return {
    dataDir,
    setup() {
      fs.mkdirSync(dataDir, { recursive: true });
      resetMasterKey();
      resetDb();
      initTestMasterKey();
      getDb();
    },
    teardown() {
      closeDb();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
