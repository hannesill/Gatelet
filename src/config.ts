import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let _adminToken: string | undefined = process.env.GATELET_ADMIN_TOKEN;

export const config = {
  get MCP_PORT() { return Number(process.env.GATELET_MCP_PORT) || 4000; },
  get ADMIN_PORT() { return Number(process.env.GATELET_ADMIN_PORT) || 4001; },
  get DATA_DIR() { return process.env.GATELET_DATA_DIR || path.join(os.homedir(), '.gatelet', 'data'); },
  get ADMIN_TOKEN() { return _adminToken; },
  set ADMIN_TOKEN(value: string | undefined) { _adminToken = value; },
};

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
