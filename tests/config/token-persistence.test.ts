import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DATA_DIR = path.join(os.tmpdir(), `gatelet-token-test-${Date.now()}`);

// Point config to our test dir
process.env.GATELET_DATA_DIR = TEST_DATA_DIR;

import { loadAdminToken, saveAdminToken } from '../../src/config.js';

describe('Admin token persistence', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true, mode: 0o700 });
    const tokenPath = path.join(TEST_DATA_DIR, 'admin.token');
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  });

  afterAll(() => {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('loadAdminToken returns null when file does not exist', () => {
    expect(loadAdminToken()).toBeNull();
  });

  it('saveAdminToken writes and loadAdminToken reads back', () => {
    saveAdminToken('my-secret-token');
    expect(loadAdminToken()).toBe('my-secret-token');
  });

  it('saveAdminToken sets restrictive file permissions', () => {
    saveAdminToken('token-123');
    const tokenPath = path.join(TEST_DATA_DIR, 'admin.token');
    const stat = fs.statSync(tokenPath);
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('loadAdminToken trims whitespace/newlines', () => {
    const tokenPath = path.join(TEST_DATA_DIR, 'admin.token');
    fs.writeFileSync(tokenPath, '  token-with-spaces  \n');
    expect(loadAdminToken()).toBe('token-with-spaces');
  });

  it('loadAdminToken returns null for empty file', () => {
    const tokenPath = path.join(TEST_DATA_DIR, 'admin.token');
    fs.writeFileSync(tokenPath, '');
    expect(loadAdminToken()).toBeNull();
  });

  it('saveAdminToken creates parent directories if needed', () => {
    const nestedDir = path.join(TEST_DATA_DIR, 'nested', 'deep');
    process.env.GATELET_DATA_DIR = nestedDir;
    try {
      saveAdminToken('nested-token');
      const tokenPath = path.join(nestedDir, 'admin.token');
      expect(fs.existsSync(tokenPath)).toBe(true);
      expect(fs.readFileSync(tokenPath, 'utf-8')).toBe('nested-token');
    } finally {
      process.env.GATELET_DATA_DIR = TEST_DATA_DIR;
      fs.rmSync(path.join(TEST_DATA_DIR, 'nested'), { recursive: true, force: true });
    }
  });
});
