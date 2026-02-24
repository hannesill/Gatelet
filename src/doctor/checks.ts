import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import type { DoctorCheck, DoctorResult, CheckStatus } from './index.js';
import { config, loadAdminToken, saveAdminToken } from '../config.js';

interface CheckContext {
  dataDir: string;
  hasMasterKey: boolean;
  hasDatabase: boolean;
}

type CheckFn = (ctx: CheckContext, fix: boolean) => DoctorResult | Promise<DoctorResult>;

function result(check: DoctorCheck, status: CheckStatus, message: string, fixed?: boolean): DoctorResult {
  return { check, status, message, ...(fixed !== undefined && { fixed }) };
}

// ── Check 1: Data directory ──────────────────────────────────────────

const DATA_DIR_CHECK: DoctorCheck = {
  id: 'data_dir',
  name: 'Data directory',
  description: 'Check that the data directory exists and is writable',
  fixable: true,
};

function checkDataDir(ctx: CheckContext, fix: boolean): DoctorResult {
  const dir = ctx.dataDir;
  if (fs.existsSync(dir)) {
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      return result(DATA_DIR_CHECK, 'pass', `${dir} exists and is writable`);
    } catch {
      return result(DATA_DIR_CHECK, 'fail', `${dir} exists but is not writable`);
    }
  }

  if (fix) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return result(DATA_DIR_CHECK, 'pass', `Created ${dir}`, true);
    } catch (e) {
      return result(DATA_DIR_CHECK, 'fail', `Failed to create ${dir}: ${(e as Error).message}`);
    }
  }

  return result(DATA_DIR_CHECK, 'fail', `${dir} does not exist (run with --fix to create)`);
}

// ── Check 2: Master key ─────────────────────────────────────────────

const MASTER_KEY_CHECK: DoctorCheck = {
  id: 'master_key',
  name: 'Master key',
  description: 'Check that the master key exists and has correct permissions',
  fixable: true,
};

function checkMasterKey(ctx: CheckContext, fix: boolean): DoctorResult {
  const keyPath = path.join(ctx.dataDir, 'master.key');
  if (!fs.existsSync(keyPath)) {
    return result(MASTER_KEY_CHECK, 'fail', `Master key not found at ${keyPath}`);
  }

  const content = fs.readFileSync(keyPath);
  if (content.length !== 32) {
    return result(MASTER_KEY_CHECK, 'fail', `Master key has wrong length (${content.length} bytes, expected 32)`);
  }

  const stat = fs.statSync(keyPath);
  const mode = stat.mode & 0o777;
  if (mode !== 0o600) {
    if (fix) {
      fs.chmodSync(keyPath, 0o600);
      ctx.hasMasterKey = true;
      return result(MASTER_KEY_CHECK, 'pass', `Fixed permissions on master key (was 0o${mode.toString(8)})`, true);
    }
    return result(MASTER_KEY_CHECK, 'warn', `Master key permissions are 0o${mode.toString(8)} (should be 0o600)`);
  }

  ctx.hasMasterKey = true;
  return result(MASTER_KEY_CHECK, 'pass', 'Master key exists, 32 bytes, correct permissions');
}

// ── Check 3: Database ───────────────────────────────────────────────

const DATABASE_CHECK: DoctorCheck = {
  id: 'database',
  name: 'Database',
  description: 'Check that the SQLite database opens and has expected tables',
  fixable: false,
};

async function checkDatabase(ctx: CheckContext): Promise<DoctorResult> {
  if (!ctx.hasMasterKey) {
    return result(DATABASE_CHECK, 'skip', 'Skipped (master key check failed)');
  }

  const dbPath = path.join(ctx.dataDir, 'gatelet.db');
  if (!fs.existsSync(dbPath)) {
    return result(DATABASE_CHECK, 'fail', `Database not found at ${dbPath}`);
  }

  try {
    const mod = await import('better-sqlite3');
    const Database = mod.default;
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    db.close();

    const tableNames = tables.map(t => t.name);
    const required = ['connections', 'api_keys', 'audit_log', 'settings'];
    const missing = required.filter(t => !tableNames.includes(t));

    if (missing.length > 0) {
      return result(DATABASE_CHECK, 'fail', `Missing tables: ${missing.join(', ')}`);
    }

    ctx.hasDatabase = true;
    return result(DATABASE_CHECK, 'pass', `Database OK (tables: ${required.join(', ')})`);
  } catch (e) {
    return result(DATABASE_CHECK, 'fail', `Cannot open database: ${(e as Error).message}`);
  }
}

// ── Check 4: Admin token ────────────────────────────────────────────

const ADMIN_TOKEN_CHECK: DoctorCheck = {
  id: 'admin_token',
  name: 'Admin token',
  description: 'Check that an admin token is configured (env var or file)',
  fixable: true,
};

function checkAdminToken(ctx: CheckContext, fix: boolean): DoctorResult {
  if (process.env.GATELET_ADMIN_TOKEN) {
    return result(ADMIN_TOKEN_CHECK, 'pass', 'Admin token set via GATELET_ADMIN_TOKEN env var');
  }

  const fileToken = loadAdminToken();
  if (fileToken) {
    return result(ADMIN_TOKEN_CHECK, 'pass', 'Admin token loaded from file');
  }

  if (fix) {
    const token = crypto.randomBytes(32).toString('hex');
    saveAdminToken(token);
    return result(ADMIN_TOKEN_CHECK, 'pass', 'Generated and saved admin token', true);
  }

  return result(ADMIN_TOKEN_CHECK, 'warn', 'No admin token configured (run with --fix to generate)');
}

// ── Check 5: MCP port ───────────────────────────────────────────────

const PORT_MCP_CHECK: DoctorCheck = {
  id: 'port_mcp',
  name: 'MCP port',
  description: 'Check that the MCP port is available',
  fixable: false,
};

async function checkPort(port: number, check: DoctorCheck): Promise<DoctorResult> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(result(check, 'fail', `Port ${port} is already in use`));
      } else {
        resolve(result(check, 'fail', `Cannot check port ${port}: ${err.message}`));
      }
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(result(check, 'pass', `Port ${port} is available`));
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

// ── Check 6: Admin port ─────────────────────────────────────────────

const PORT_ADMIN_CHECK: DoctorCheck = {
  id: 'port_admin',
  name: 'Admin port',
  description: 'Check that the admin port is available',
  fixable: false,
};

// ── Check 7: Connections ────────────────────────────────────────────

const CONNECTIONS_CHECK: DoctorCheck = {
  id: 'connections',
  name: 'Connections',
  description: 'Check that all connections have required fields',
  fixable: false,
};

async function checkConnections(ctx: CheckContext): Promise<DoctorResult> {
  if (!ctx.hasDatabase) {
    return result(CONNECTIONS_CHECK, 'skip', 'Skipped (database check failed)');
  }

  try {
    const { listConnections } = await import('../db/connections.js');
    const connections = listConnections();

    if (connections.length === 0) {
      return result(CONNECTIONS_CHECK, 'warn', 'No connections configured');
    }

    const issues: string[] = [];
    for (const conn of connections) {
      if (!conn.provider_id) issues.push(`${conn.id}: missing provider_id`);
      if (!conn.account_name) issues.push(`${conn.id}: missing account_name`);
      if (!conn.policy_yaml) issues.push(`${conn.id}: missing policy_yaml`);
    }

    if (issues.length > 0) {
      return result(CONNECTIONS_CHECK, 'fail', `Connection issues: ${issues.join('; ')}`);
    }

    return result(CONNECTIONS_CHECK, 'pass', `${connections.length} connection(s) OK`);
  } catch (e) {
    return result(CONNECTIONS_CHECK, 'fail', `Cannot check connections: ${(e as Error).message}`);
  }
}

// ── Check 8: OAuth tokens ───────────────────────────────────────────

const OAUTH_TOKENS_CHECK: DoctorCheck = {
  id: 'oauth_tokens',
  name: 'OAuth tokens',
  description: 'Check that OAuth tokens are not expired',
  fixable: false,
};

async function checkOAuthTokens(ctx: CheckContext): Promise<DoctorResult> {
  if (!ctx.hasDatabase || !ctx.hasMasterKey) {
    return result(OAUTH_TOKENS_CHECK, 'skip', 'Skipped (database or master key check failed)');
  }

  try {
    const { listConnections, getConnectionWithCredentials } = await import('../db/connections.js');
    const connections = listConnections();
    const expired: string[] = [];

    for (const conn of connections) {
      try {
        const full = getConnectionWithCredentials(conn.id);
        if (full?.credentials?.expiry_date) {
          const expiry = full.credentials.expiry_date as number;
          if (typeof expiry === 'number' && expiry < Date.now()) {
            expired.push(`${conn.account_name} (${conn.provider_id})`);
          }
        }
      } catch {
        // Skip individual connection errors
      }
    }

    if (expired.length > 0) {
      return result(OAUTH_TOKENS_CHECK, 'warn', `Expired tokens: ${expired.join(', ')}`);
    }

    return result(OAUTH_TOKENS_CHECK, 'pass', 'All OAuth tokens are valid or have no expiry');
  } catch (e) {
    return result(OAUTH_TOKENS_CHECK, 'fail', `Cannot check tokens: ${(e as Error).message}`);
  }
}

// ── Check 9: Encryption ────────────────────────────────────────────

const ENCRYPTION_CHECK: DoctorCheck = {
  id: 'encryption',
  name: 'Encryption',
  description: 'Verify encrypt/decrypt roundtrip works',
  fixable: false,
};

async function checkEncryption(ctx: CheckContext): Promise<DoctorResult> {
  if (!ctx.hasMasterKey) {
    return result(ENCRYPTION_CHECK, 'skip', 'Skipped (master key check failed)');
  }

  try {
    const { encryptString, decryptString } = await import('../db/crypto.js');
    const testValue = 'gatelet-doctor-test-' + Date.now();
    const encrypted = encryptString(testValue);
    const decrypted = decryptString(encrypted);

    if (decrypted !== testValue) {
      return result(ENCRYPTION_CHECK, 'fail', 'Encrypt/decrypt roundtrip mismatch');
    }

    return result(ENCRYPTION_CHECK, 'pass', 'Encrypt/decrypt roundtrip OK');
  } catch (e) {
    return result(ENCRYPTION_CHECK, 'fail', `Encryption test failed: ${(e as Error).message}`);
  }
}

// ── Check 10: Providers ─────────────────────────────────────────────

const PROVIDERS_CHECK: DoctorCheck = {
  id: 'providers',
  name: 'Providers',
  description: 'Check that all providers load without errors',
  fixable: false,
};

async function checkProviders(): Promise<DoctorResult> {
  try {
    const { getAllProviders } = await import('../providers/registry.js');
    const providers = getAllProviders();
    const names = providers.map(p => p.displayName).join(', ');
    return result(PROVIDERS_CHECK, 'pass', `${providers.length} provider(s) loaded: ${names}`);
  } catch (e) {
    return result(PROVIDERS_CHECK, 'fail', `Provider loading failed: ${(e as Error).message}`);
  }
}

// ── Check 11: Policies ──────────────────────────────────────────────

const POLICIES_CHECK: DoctorCheck = {
  id: 'policies',
  name: 'Policies',
  description: 'Check that all connection policies pass strict validation',
  fixable: false,
};

async function checkPolicies(ctx: CheckContext): Promise<DoctorResult> {
  if (!ctx.hasDatabase) {
    return result(POLICIES_CHECK, 'skip', 'Skipped (database check failed)');
  }

  try {
    const { listConnections } = await import('../db/connections.js');
    const { parsePolicy } = await import('../policy/parser.js');
    const connections = listConnections();
    const issues: string[] = [];
    let totalWarnings = 0;

    for (const conn of connections) {
      try {
        const { warnings } = parsePolicy(conn.policy_yaml);
        totalWarnings += warnings.length;
        if (warnings.length > 0) {
          issues.push(`${conn.account_name}: ${warnings.length} warning(s)`);
        }
      } catch (e) {
        issues.push(`${conn.account_name}: ${(e as Error).message}`);
      }
    }

    if (issues.some(i => !i.includes('warning'))) {
      return result(POLICIES_CHECK, 'fail', `Policy errors: ${issues.join('; ')}`);
    }

    if (totalWarnings > 0) {
      return result(POLICIES_CHECK, 'warn', `Policies have warnings: ${issues.join('; ')}`);
    }

    return result(POLICIES_CHECK, 'pass', `${connections.length} policy/policies validated OK`);
  } catch (e) {
    return result(POLICIES_CHECK, 'fail', `Cannot check policies: ${(e as Error).message}`);
  }
}

// ── Orchestrator ────────────────────────────────────────────────────

export async function runChecks(options: { fix?: boolean } = {}): Promise<DoctorResult[]> {
  const fix = options.fix ?? false;
  const ctx: CheckContext = {
    dataDir: config.DATA_DIR,
    hasMasterKey: false,
    hasDatabase: false,
  };

  const results: DoctorResult[] = [];

  // Sequential checks with shared context
  results.push(checkDataDir(ctx, fix));
  results.push(checkMasterKey(ctx, fix));
  results.push(await checkDatabase(ctx));
  results.push(checkAdminToken(ctx, fix));
  results.push(await checkPort(config.MCP_PORT, PORT_MCP_CHECK));
  results.push(await checkPort(config.ADMIN_PORT, PORT_ADMIN_CHECK));
  results.push(await checkConnections(ctx));
  results.push(await checkOAuthTokens(ctx));
  results.push(await checkEncryption(ctx));
  results.push(await checkProviders());
  results.push(await checkPolicies(ctx));

  return results;
}
