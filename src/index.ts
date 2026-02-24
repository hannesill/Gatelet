import fs from 'node:fs';
import crypto from 'node:crypto';
import { config, loadAdminToken, saveAdminToken } from './config.js';
import { getDb } from './db/database.js';
import { getMasterKey } from './db/crypto.js';
import { listConnections } from './db/connections.js';
import { listApiKeys } from './db/api-keys.js';
import { getProvider } from './providers/registry.js';
import { startAdminServer } from './admin/server.js';
import { startMcpServer, getRegisteredToolCount } from './mcp/server.js';

export const startTime = Date.now();

function main(): void {
  // Ensure data directory exists
  fs.mkdirSync(config.DATA_DIR, { recursive: true });

  // Initialize master key (creates if not exists)
  getMasterKey();

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
  startAdminServer();
  startMcpServer();

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
  console.log('Gatelet v0.3');
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
