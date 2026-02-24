import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from './config.js';
import { getDb } from './db/database.js';
import { getMasterKey } from './db/crypto.js';
import { listConnections } from './db/connections.js';
import { startAdminServer } from './admin/server.js';
import { startMcpServer, getRegisteredToolCount } from './mcp/server.js';

function main(): void {
  // Ensure data directory exists
  fs.mkdirSync(config.DATA_DIR, { recursive: true });

  // Initialize master key (creates if not exists)
  getMasterKey();

  // Initialize database (runs migrations)
  getDb();

  // Generate admin token if not set
  if (!config.ADMIN_TOKEN) {
    config.ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');
    console.log(`Generated admin token: ${config.ADMIN_TOKEN}`);
    console.log('Set GATELET_ADMIN_TOKEN env var to persist this token.');
  }

  // Start servers
  startAdminServer();
  startMcpServer();

  // Startup summary
  const connections = listConnections();
  const toolCount = getRegisteredToolCount();
  console.log(`Gatelet started:`);
  console.log(`  MCP server:   :${config.MCP_PORT}`);
  console.log(`  Admin server: :${config.ADMIN_PORT}`);
  console.log(`  Connections:  ${connections.length}`);
  console.log(`  Tools:        ${toolCount}`);
}

main();
