import path from 'node:path';
import os from 'node:os';

let _adminToken: string | undefined = process.env.GATELET_ADMIN_TOKEN;

export const config = {
  get MCP_PORT() { return Number(process.env.GATELET_MCP_PORT) || 4000; },
  get ADMIN_PORT() { return Number(process.env.GATELET_ADMIN_PORT) || 4001; },
  get DATA_DIR() { return process.env.GATELET_DATA_DIR || path.join(os.homedir(), '.gatelet', 'data'); },
  get ADMIN_TOKEN() { return _adminToken; },
  set ADMIN_TOKEN(value: string | undefined) { _adminToken = value; },
  get GOOGLE_CLIENT_ID() { return process.env.GOOGLE_CLIENT_ID; },
  get GOOGLE_CLIENT_SECRET() { return process.env.GOOGLE_CLIENT_SECRET; },
  get GOOGLE_REDIRECT_URI() { return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4001/api/connections/oauth/google/callback'; },
};
