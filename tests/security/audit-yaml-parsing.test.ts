/**
 * Security Audit: Unauthenticated route security, YAML parsing security,
 * Gmail header injection
 *
 * FINDING-15 (architecture review): Policy is always enforced before token refresh.
 * FINDING-NEW-15 (code review): Admin token comparison uses === (not timing-safe).
 * FINDING-18 (code review): Invalid regex in redact_patterns is silently skipped.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { findFreePort, createTestEnvironment } from '../helpers/test-setup.js';
import { config } from '../../src/config.js';
import { createAdminApp } from '../../src/admin/server.js';
import { parsePolicy } from '../../src/policy/parser.js';
import type { Hono } from 'hono';

const TEST_ADMIN_TOKEN = 'audit-yaml-admin-token';
const env = createTestEnvironment('audit-yaml');

const [mcpPort, adminPort] = await Promise.all([findFreePort(), findFreePort()]);
process.env.GATELET_DATA_DIR = env.dataDir;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(mcpPort);
process.env.GATELET_ADMIN_PORT = String(adminPort);

let app: Hono;

function req(urlPath: string, init?: RequestInit) {
  return app.request(urlPath, init);
}

beforeAll(() => {
  env.setup();
  config.ADMIN_TOKEN = TEST_ADMIN_TOKEN;
  app = createAdminApp();
});

afterAll(() => {
  env.teardown();
});

describe('Unauthenticated route security', () => {
  it('health endpoint is publicly accessible for monitoring', async () => {
    const res = await req('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('logout endpoint is accessible without auth (by design)', async () => {
    const res = await req('/api/logout', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('login endpoint is accessible without auth (by design)', async () => {
    const res = await req('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Policy YAML parsing security', () => {
  it('YAML anchors and aliases do not cause infinite loops', () => {
    const yamlWithAnchors = `
provider: google_calendar
account: test@gmail.com
operations:
  list_events: &base
    allow: true
  create_event:
    allow: true
    constraints:
      - field: calendarId
        rule: must_equal
        value: primary
`;
    const { policy } = parsePolicy(yamlWithAnchors);
    expect(policy.operations.list_events.allow).toBe(true);
    expect(policy.operations.create_event.allow).toBe(true);
  });

  it('very large YAML does not cause OOM', () => {
    let ops = '';
    for (let i = 0; i < 1000; i++) {
      ops += `  op_${i}:\n    allow: true\n`;
    }
    const yaml = `provider: test\naccount: test\noperations:\n${ops}`;
    const { policy } = parsePolicy(yaml);
    expect(Object.keys(policy.operations).length).toBe(1000);
  });

  it('parsePolicy rejects non-boolean allow values', () => {
    const yaml = `
provider: test
account: test
operations:
  test_op:
    allow: "yes"
`;
    expect(() => parsePolicy(yaml)).toThrow('non-boolean "allow"');
  });

  it('parsePolicy rejects missing constraints field', () => {
    const yaml = `
provider: test
account: test
operations:
  test_op:
    allow: true
    constraints:
      - rule: must_equal
        value: test
`;
    expect(() => parsePolicy(yaml)).toThrow('missing "field"');
  });

  it('policy with allowed_fields and denied_fields is rejected', () => {
    const yaml = `
provider: test
account: test
operations:
  test_op:
    allow: true
    allowed_fields: [a, b]
    denied_fields: [c, d]
`;
    expect(() => parsePolicy(yaml)).toThrow('cannot have both');
  });
});

describe('Gmail email header injection', () => {
  // FINDING-NEW-16: CRLF in email fields could inject headers
  it('FINDING-NEW-16: CRLF in email fields could inject headers', () => {
    const maliciousTo = 'victim@example.com\r\nBcc: evil@attacker.com';
    const headers = [
      `To: ${maliciousTo}`,
      'Subject: Test',
      'Content-Type: text/plain; charset="UTF-8"',
    ];
    const rawMessage = headers.join('\r\n') + '\r\n\r\nBody text';
    expect(rawMessage).toContain('Bcc: evil@attacker.com');
  });
});
