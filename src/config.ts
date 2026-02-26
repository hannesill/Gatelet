import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Read a secret from a file path (Docker secrets / _FILE convention).
 * Returns the file contents trimmed, or undefined if the path doesn't exist.
 */
export function readSecretFile(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf-8').trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a secret: _FILE env var (read from file) > direct env var > undefined.
 */
export function resolveEnvSecret(envName: string): string | undefined {
  const filePath = process.env[`${envName}_FILE`];
  if (filePath) {
    const value = readSecretFile(filePath);
    if (value) return value;
  }
  return process.env[envName];
}

let _adminToken: string | undefined = resolveEnvSecret('GATELET_ADMIN_TOKEN');

export const config = {
  get MCP_PORT() { return Number(process.env.GATELET_MCP_PORT) || 4000; },
  get ADMIN_PORT() { return Number(process.env.GATELET_ADMIN_PORT) || 4001; },
  get DATA_DIR() { return process.env.GATELET_DATA_DIR || path.join(os.homedir(), '.gatelet', 'data'); },
  get ADMIN_TOKEN() { return _adminToken; },
  set ADMIN_TOKEN(value: string | undefined) { _adminToken = value; },
};

// Local dev only — Docker deployments use root-owned secrets (see install.sh).
// This path writes to ~/.gatelet/data/ which is user-readable, so it does NOT
// protect against host-based agents running as the same user. That's acceptable
// for development; production relies on the root-owned /usr/local/etc/gatelet/secrets/.
export function loadAdminToken(): string | null {
  const tokenPath = path.join(config.DATA_DIR, 'admin.token');
  try {
    const token = fs.readFileSync(tokenPath, 'utf-8').trim();
    return token || null;
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string): void {
  const tokenPath = path.join(config.DATA_DIR, 'admin.token');
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
}
