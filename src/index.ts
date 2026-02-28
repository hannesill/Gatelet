import fs from 'node:fs';
import crypto from 'node:crypto';
import { config, loadAdminToken, saveAdminToken, resolveEnvSecret } from './config.js';
import { getDb } from './db/database.js';
import {
  deriveKeyFromToken,
  migrateFromPassphrase,
  migrateFromKeyFile,
  needsMigration,
} from './db/crypto.js';
import { listConnections } from './db/connections.js';
import { listApiKeys } from './db/api-keys.js';
import { getProvider } from './providers/registry.js';
import { startAdminServer } from './admin/server.js';
import { startMcpServer, getRegisteredToolCount } from './mcp/server.js';
import { closeDb } from './db/database.js';
import path from 'node:path';
import { VERSION } from './version.js';
import { startUpdateChecker, stopUpdateChecker } from './update-checker.js';

function initMasterKey(adminToken: string): void {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });

  // Migration from legacy schemes
  if (needsMigration()) {
    const saltPath = path.join(config.DATA_DIR, 'master.salt');
    const keyPath = path.join(config.DATA_DIR, 'master.key');

    // Database needs to be initialized before migration (to re-encrypt rows)
    const db = getDb();

    if (fs.existsSync(saltPath)) {
      // Passphrase mode → admin-token-derived key
      const passphrase = resolveEnvSecret('GATELET_PASSPHRASE');
      if (!passphrase) {
        console.error('Error: Migration required but no passphrase available.');
        console.error('');
        console.error('  Your installation uses passphrase-based encryption and needs to');
        console.error('  migrate to admin-token-derived encryption. Provide the passphrase');
        console.error('  one last time so Gatelet can re-encrypt your data.');
        console.error('');
        console.error('  Set GATELET_PASSPHRASE env var or GATELET_PASSPHRASE_FILE and restart.');
        console.error('');
        process.exit(1);
      }

      console.log('');
      console.log('Migrating from passphrase-based encryption to admin-token-derived key...');
      migrateFromPassphrase(passphrase, adminToken, db);
      console.log('Migration complete. Passphrase is no longer needed.');
      console.log('');
      return;
    }

    if (fs.existsSync(keyPath)) {
      // Legacy master.key → admin-token-derived key
      console.log('');
      console.log('Migrating from legacy master.key to admin-token-derived key...');
      migrateFromKeyFile(adminToken, db);
      console.log('Migration complete. Old master.key backed up to master.key.backup.');
      console.log('');
      return;
    }

    // needsMigration() flagged legacy files but they disappeared before we
    // could read them (TOCTOU race). Fall through to normal derivation.
  }

  // Derive key from admin token (deterministic, no files needed).
  // Also reached as a fallback if the migration block falls through.
  deriveKeyFromToken(adminToken);
}

async function main(): Promise<void> {
  // The admin token serves double duty: it authenticates admin dashboard access
  // AND derives the master encryption key (HKDF-SHA256) for all stored credentials.
  // Compromising this token gives both admin access and decryption capability.
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

  // Initialize master key (derived from admin token)
  initMasterKey(config.ADMIN_TOKEN!);

  // Initialize database (runs migrations)
  getDb();

  // Start servers
  const adminServer = startAdminServer();
  const mcpServer = startMcpServer();
  startUpdateChecker();

  // Graceful shutdown
  function shutdown() {
    console.log('\nShutting down...');
    stopUpdateChecker();
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
  console.log(`Gatelet v${VERSION}`);
  console.log('');
  // Mask the token whenever it was loaded from a file (Docker or native host service mode).
  // Agents can read logs without sudo (`docker logs`, macOS unified log), so never print the
  // actual token in service deployments. In local dev mode, print the full URL for convenience.
  const tokenFile = process.env.GATELET_ADMIN_TOKEN_FILE;
  if (tokenFile || config.IS_DOCKER) {
    const hint = tokenFile ? `sudo cat ${tokenFile}` : 'sudo cat /usr/local/etc/gatelet/secrets/admin-token';
    console.log(`  Admin:  http://localhost:${config.ADMIN_PORT}  (token masked — use ${hint})`);
  } else {
    console.log(`  Admin:  http://localhost:${config.ADMIN_PORT}/?token=${encodeURIComponent(config.ADMIN_TOKEN!)}`);
  }
  console.log(`  MCP:    http://localhost:${config.MCP_PORT}/mcp`);
  console.log('');
  console.log(`  Connections:  ${connections.length}${connSummary ? ` (${connSummary})` : ''}`);
  console.log(`  Tools:        ${toolCount} enabled`);
  console.log(`  API keys:     ${activeKeys} active`);
  console.log('');
  console.log('Ready.');
}

main();
