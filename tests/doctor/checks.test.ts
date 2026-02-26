import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { findFreePort, createTestEnvironment } from '../helpers/test-setup.js';

const env = createTestEnvironment('doctor');
process.env.GATELET_DATA_DIR = env.dataDir;

const [freePort1, freePort2] = await Promise.all([findFreePort(), findFreePort()]);
process.env.GATELET_MCP_PORT = String(freePort1);
process.env.GATELET_ADMIN_PORT = String(freePort2);

import { runDoctor } from '../../src/doctor/index.js';
import { saveAdminToken } from '../../src/config.js';
import { createConnection } from '../../src/db/connections.js';
import sodium from 'sodium-native';

describe('Doctor checks', () => {
  beforeAll(() => {
    env.setup();

    // Create a dummy master.salt for doctor checks (simulates passphrase mode)
    const saltPath = path.join(env.dataDir, 'master.salt');
    const salt = Buffer.alloc(sodium.crypto_pwhash_SALTBYTES);
    sodium.randombytes_buf(salt);
    fs.writeFileSync(saltPath, salt, { mode: 0o600 });
  });

  afterAll(() => {
    env.teardown();
  });

  describe('data_dir check', () => {
    it('passes when data dir exists', async () => {
      const results = await runDoctor();
      const check = results.find(r => r.check.id === 'data_dir');
      expect(check).toBeDefined();
      expect(check!.status).toBe('pass');
    });

    it('creates data dir with --fix when missing', async () => {
      const missingDir = path.join(env.dataDir, 'doctor-fix-test');
      const origDir = process.env.GATELET_DATA_DIR;
      process.env.GATELET_DATA_DIR = missingDir;
      try {
        const results = await runDoctor({ fix: true });
        const check = results.find(r => r.check.id === 'data_dir');
        expect(check!.status).toBe('pass');
        expect(check!.fixed).toBe(true);
        expect(fs.existsSync(missingDir)).toBe(true);
      } finally {
        process.env.GATELET_DATA_DIR = origDir;
        fs.rmSync(missingDir, { recursive: true, force: true });
      }
    });
  });

  describe('admin_token check', () => {
    it('warns when no admin token configured', async () => {
      const origToken = process.env.GATELET_ADMIN_TOKEN;
      delete process.env.GATELET_ADMIN_TOKEN;
      const tokenPath = path.join(env.dataDir, 'admin.token');
      if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);

      try {
        const results = await runDoctor();
        const check = results.find(r => r.check.id === 'admin_token');
        expect(check!.status).toBe('warn');
      } finally {
        if (origToken) process.env.GATELET_ADMIN_TOKEN = origToken;
      }
    });

    it('fixes admin token with --fix', async () => {
      const origToken = process.env.GATELET_ADMIN_TOKEN;
      delete process.env.GATELET_ADMIN_TOKEN;
      const tokenPath = path.join(env.dataDir, 'admin.token');
      if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);

      try {
        const results = await runDoctor({ fix: true });
        const check = results.find(r => r.check.id === 'admin_token');
        expect(check!.status).toBe('pass');
        expect(check!.fixed).toBe(true);
        expect(fs.existsSync(tokenPath)).toBe(true);
      } finally {
        if (origToken) process.env.GATELET_ADMIN_TOKEN = origToken;
      }
    });

    it('passes when GATELET_ADMIN_TOKEN env var is set', async () => {
      process.env.GATELET_ADMIN_TOKEN = 'test-doctor-token';
      try {
        const results = await runDoctor();
        const check = results.find(r => r.check.id === 'admin_token');
        expect(check!.status).toBe('pass');
        expect(check!.message).toContain('env var');
      } finally {
        delete process.env.GATELET_ADMIN_TOKEN;
      }
    });
  });

  describe('policies check', () => {
    it('validates good policies as pass', async () => {
      createConnection({
        provider_id: 'google_calendar',
        account_name: 'doctor-test@gmail.com',
        credentials: { access_token: 'tok', refresh_token: 'ref' },
        policy_yaml: `provider: google_calendar\naccount: doctor-test@gmail.com\noperations:\n  list_calendars:\n    allow: true\n`,
      });

      const results = await runDoctor();
      const check = results.find(r => r.check.id === 'policies');
      expect(check).toBeDefined();
      expect(['pass', 'warn']).toContain(check!.status);
    });
  });

  describe('port checks', () => {
    it('passes when ports are available', async () => {
      const results = await runDoctor();
      const mcpCheck = results.find(r => r.check.id === 'port_mcp');
      const adminCheck = results.find(r => r.check.id === 'port_admin');
      expect(mcpCheck!.status).toBe('pass');
      expect(adminCheck!.status).toBe('pass');
    });

    it('detects port in use', async () => {
      const server = net.createServer();
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });
      const port = (server.address() as net.AddressInfo).port;
      const origPort = process.env.GATELET_MCP_PORT;
      process.env.GATELET_MCP_PORT = String(port);

      try {
        const results = await runDoctor();
        const mcpCheck = results.find(r => r.check.id === 'port_mcp');
        expect(mcpCheck!.status).toBe('fail');
        expect(mcpCheck!.message).toContain('already in use');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        process.env.GATELET_MCP_PORT = origPort;
      }
    });
  });

  describe('encryption check', () => {
    it('passes when master key is valid', async () => {
      const results = await runDoctor();
      const check = results.find(r => r.check.id === 'encryption');
      expect(check).toBeDefined();
      if (check!.status !== 'skip') {
        expect(check!.status).toBe('pass');
      }
    });
  });

  describe('providers check', () => {
    it('loads all providers', async () => {
      const results = await runDoctor();
      const check = results.find(r => r.check.id === 'providers');
      expect(check!.status).toBe('pass');
      expect(check!.message).toContain('provider(s) loaded');
    });
  });
});
