import fs from 'node:fs';
import crypto from 'node:crypto';
import { config, loadAdminToken, saveAdminToken } from './config.js';
import { getDb } from './db/database.js';
import {
  deriveKeyFromPassphrase,
  verifyMasterKey,
  migrateFromKeyFile,
  needsMigration,
  isFreshInstall,
  isPassphraseMode,
} from './db/crypto.js';
import { listConnections } from './db/connections.js';
import { listApiKeys } from './db/api-keys.js';
import { getProvider } from './providers/registry.js';
import { startAdminServer } from './admin/server.js';
import { startMcpServer, getRegisteredToolCount } from './mcp/server.js';
import { closeDb } from './db/database.js';
import { promptPassphrase } from './cli-prompt.js';

// Re-export so any existing imports from index.ts still work
export { startTime } from './start-time.js';

async function initMasterKey(): Promise<void> {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });

  // Case 1: Migration from legacy master.key to passphrase
  if (needsMigration()) {
    console.log('');
    console.log('Gatelet is migrating to passphrase-based encryption.');
    console.log('Your existing master.key will be replaced with a passphrase-derived key.');
    console.log('');

    let passphrase: string;
    if (process.env.GATELET_PASSPHRASE) {
      passphrase = process.env.GATELET_PASSPHRASE;
    } else {
      passphrase = await promptPassphrase('Enter a new passphrase: ');
      const confirm = await promptPassphrase('Confirm passphrase: ');
      if (passphrase !== confirm) {
        console.error('Error: Passphrases do not match.');
        process.exit(1);
      }
    }

    if (passphrase.length < 8) {
      console.error('Error: Passphrase must be at least 8 characters.');
      process.exit(1);
    }

    // Database needs to be initialized before migration (to re-encrypt rows)
    const db = getDb();
    migrateFromKeyFile(passphrase, db);

    console.log('');
    console.log('Migration complete. The old master.key has been backed up to master.key.backup.');
    console.log('You can delete it after verifying everything works.');
    console.log('');
    return;
  }

  // Case 2: Existing passphrase installation
  if (isPassphraseMode()) {
    let passphrase: string;
    if (process.env.GATELET_PASSPHRASE) {
      passphrase = process.env.GATELET_PASSPHRASE;
    } else {
      passphrase = await promptPassphrase('Enter Gatelet passphrase: ');
    }

    deriveKeyFromPassphrase(passphrase);

    if (!verifyMasterKey()) {
      console.error('Error: Incorrect passphrase. Cannot decrypt existing data.');
      process.exit(1);
    }
    return;
  }

  // Case 3: Fresh install — prompt for passphrase
  if (isFreshInstall()) {
    let passphrase: string;
    if (process.env.GATELET_PASSPHRASE) {
      passphrase = process.env.GATELET_PASSPHRASE;
    } else {
      console.log('');
      console.log('Welcome to Gatelet! Set a passphrase to encrypt your data.');
      console.log('You will need this passphrase every time the server starts.');
      console.log('');
      passphrase = await promptPassphrase('Enter a new passphrase: ');
      const confirm = await promptPassphrase('Confirm passphrase: ');
      if (passphrase !== confirm) {
        console.error('Error: Passphrases do not match.');
        process.exit(1);
      }
    }

    if (passphrase.length < 8) {
      console.error('Error: Passphrase must be at least 8 characters.');
      process.exit(1);
    }

    deriveKeyFromPassphrase(passphrase);
    verifyMasterKey(); // Creates verifier file
    return;
  }
}

async function main(): Promise<void> {
  // Initialize master key (passphrase-derived)
  await initMasterKey();

  // Initialize database (runs migrations)
  getDb();

  // Resolve admin token: env var > file > generate + save
  if (!config.ADMIN_TOKEN) {
    const fileToken = loadAdminToken();
    if (fileToken) {
      config.ADMIN_TOKEN = fileToken;
    } else {
      const generated = crypto.randomBytes(32).toString('hex');
      config.ADMIN_TOKEN = generated;
      saveAdminToken(generated);
    }
  }

  // Start servers
  const adminServer = startAdminServer();
  const mcpServer = startMcpServer();

  // Graceful shutdown
  function shutdown() {
    console.log('\nShutting down...');
    adminServer.close();
    mcpServer.close();
    closeDb();
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Startup summary
  const connections = listConnections();
  const toolCount = getRegisteredToolCount();
  const apiKeys = listApiKeys();
  const activeKeys = apiKeys.filter(k => !k.revoked_at).length;

  const connSummary = connections
    .map(c => {
      const provider = getProvider(c.provider_id);
      return provider?.displayName ?? c.provider_id;
    })
    .join(', ');

  console.log('');
  console.log('Gatelet v0.5');
  console.log('');
  console.log(`  Admin:  http://localhost:${config.ADMIN_PORT}/`);
  console.log(`  MCP:    http://localhost:${config.MCP_PORT}/mcp`);
  console.log(`  Token:  ${config.ADMIN_TOKEN}`);
  console.log('');
  console.log(`  Connections:  ${connections.length}${connSummary ? ` (${connSummary})` : ''}`);
  console.log(`  Tools:        ${toolCount} enabled`);
  console.log(`  API keys:     ${activeKeys} active`);
  console.log('');
  console.log('Ready.');
}

main();
