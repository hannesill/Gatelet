import { describe, it, expect, afterAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readSecretFile, resolveEnvSecret } from '../../src/config.js';

const TEST_DIR = path.join(os.tmpdir(), `gatelet-secret-file-test-${Date.now()}`);

describe('readSecretFile', () => {
  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('reads file contents and trims whitespace', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true, mode: 0o700 });
    const filePath = path.join(TEST_DIR, 'secret');
    fs.writeFileSync(filePath, '  my-secret-value  \n');
    expect(readSecretFile(filePath)).toBe('my-secret-value');
  });

  it('returns undefined for non-existent file', () => {
    expect(readSecretFile('/tmp/does-not-exist-gatelet-test')).toBeUndefined();
  });

  it('returns undefined for empty file', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true, mode: 0o700 });
    const filePath = path.join(TEST_DIR, 'empty');
    fs.writeFileSync(filePath, '');
    expect(readSecretFile(filePath)).toBeUndefined();
  });

  it('returns undefined for whitespace-only file', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true, mode: 0o700 });
    const filePath = path.join(TEST_DIR, 'whitespace');
    fs.writeFileSync(filePath, '   \n\n  ');
    expect(readSecretFile(filePath)).toBeUndefined();
  });
});

describe('resolveEnvSecret', () => {
  const envBackup: Record<string, string | undefined> = {};

  afterEach(() => {
    // Restore env vars
    for (const [key, val] of Object.entries(envBackup)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  function setEnv(key: string, value: string | undefined) {
    if (!(key in envBackup)) envBackup[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it('returns direct env var when no _FILE is set', () => {
    setEnv('TEST_SECRET', 'direct-value');
    setEnv('TEST_SECRET_FILE', undefined);
    expect(resolveEnvSecret('TEST_SECRET')).toBe('direct-value');
  });

  it('prefers _FILE over direct env var', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true, mode: 0o700 });
    const filePath = path.join(TEST_DIR, 'file-secret');
    fs.writeFileSync(filePath, 'from-file');

    setEnv('TEST_SECRET2', 'direct-value');
    setEnv('TEST_SECRET2_FILE', filePath);
    expect(resolveEnvSecret('TEST_SECRET2')).toBe('from-file');
  });

  it('falls back to direct env var when _FILE points to missing file', () => {
    setEnv('TEST_SECRET3', 'fallback-value');
    setEnv('TEST_SECRET3_FILE', '/tmp/does-not-exist-gatelet-test');
    expect(resolveEnvSecret('TEST_SECRET3')).toBe('fallback-value');
  });

  it('returns undefined when neither is set', () => {
    setEnv('TEST_SECRET4', undefined);
    setEnv('TEST_SECRET4_FILE', undefined);
    expect(resolveEnvSecret('TEST_SECRET4')).toBeUndefined();
  });
});
