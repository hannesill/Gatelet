/**
 * Unit tests for handleToolCall()
 *
 * Tests the core MCP tool call handler in isolation by mocking
 * database and provider dependencies.
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { findFreePort, createTestEnvironment } from '../helpers/test-setup.js';

const TEST_ADMIN_TOKEN = 'handle-tool-call-test-token';
const env = createTestEnvironment('handle-tool-call');

const [mcpPort, adminPort] = await Promise.all([findFreePort(), findFreePort()]);
process.env.GATELET_DATA_DIR = env.dataDir;
process.env.GATELET_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.GATELET_MCP_PORT = String(mcpPort);
process.env.GATELET_ADMIN_PORT = String(adminPort);

import { handleToolCall } from '../../src/mcp/server.js';
import type { RegisteredTool } from '../../src/mcp/tool-registry.js';
import type { ConnectionWithCredentials } from '../../src/db/connections.js';
import type { Provider } from '../../src/providers/types.js';
import { z } from 'zod';

// Mock modules
vi.mock('../../src/db/connections.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/connections.js')>();
  return {
    ...actual,
    getConnectionWithCredentials: vi.fn(),
    updateConnectionCredentials: vi.fn(),
    setConnectionNeedsReauth: vi.fn(),
  };
});

vi.mock('../../src/providers/registry.js', () => ({
  getProvider: vi.fn(),
}));

vi.mock('../../src/db/audit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/audit.js')>();
  return {
    ...actual,
    insertAuditEntry: vi.fn(),
  };
});

vi.mock('../../src/db/settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/settings.js')>();
  return {
    ...actual,
    getOAuthClientId: vi.fn(() => 'mock-client-id'),
    getOAuthClientSecret: vi.fn(() => 'mock-client-secret'),
  };
});

import { getConnectionWithCredentials, updateConnectionCredentials, setConnectionNeedsReauth } from '../../src/db/connections.js';
import { getProvider } from '../../src/providers/registry.js';
import { insertAuditEntry } from '../../src/db/audit.js';

const mockedGetConn = vi.mocked(getConnectionWithCredentials);
const mockedGetProvider = vi.mocked(getProvider);
const mockedAudit = vi.mocked(insertAuditEntry);
const mockedUpdateCreds = vi.mocked(updateConnectionCredentials);
const mockedSetNeedsReauth = vi.mocked(setConnectionNeedsReauth);

const MOCK_POLICY_YAML = `provider: test_provider
account: test@example.com
operations:
  test_tool_op:
    allow: true
  denied_op:
    allow: false
  constrained_op:
    allow: true
    constraints:
      - field: calendarId
        rule: must_equal
        value: "primary"
  mutated_op:
    allow: true
    mutations:
      - field: visibility
        action: set
        value: "private"
  field_policy_op:
    allow: true
    allowed_fields: [name, email]
`;

function makeRegisteredTool(overrides?: Partial<RegisteredTool>): RegisteredTool {
  return {
    tool: {
      name: 'test_tool',
      description: 'A test tool',
      policyOperation: 'test_tool_op',
      inputSchema: {
        query: z.string(),
        calendarId: z.string().optional(),
        name: z.string().optional(),
        email: z.string().optional(),
        visibility: z.string().optional(),
      },
    },
    connectionId: 'conn_test123',
    providerId: 'test_provider',
    policyOperation: 'test_tool_op',
    ...overrides,
  };
}

function makeConnection(overrides?: Partial<ConnectionWithCredentials>): ConnectionWithCredentials {
  return {
    id: 'conn_test123',
    provider_id: 'test_provider',
    account_name: 'test@example.com',
    policy_yaml: MOCK_POLICY_YAML,
    settings_json: '{}',
    credentials: { access_token: 'test_token', refresh_token: 'test_refresh' },
    enabled: 1,
    needs_reauth: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeProvider(overrides?: Partial<Provider>): Provider {
  return {
    id: 'test_provider',
    displayName: 'Test Provider',
    tools: [],
    defaultPolicyYaml: '',
    execute: vi.fn(async () => ({ data: 'mock result' })),
    ...overrides,
  };
}

beforeAll(() => {
  env.setup();
});

afterAll(() => {
  env.teardown();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleToolCall', () => {
  it('returns error and audits when connection not found', async () => {
    mockedGetConn.mockReturnValue(null as unknown as ConnectionWithCredentials);

    const result = await handleToolCall('test_tool', { query: 'test' }, makeRegisteredTool());

    expect(result.content[0].text).toBe('Error: Connection not found');
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        deny_reason: 'Connection not found',
      }),
    );
  });

  it('returns error and audits when policy YAML is invalid', async () => {
    mockedGetConn.mockReturnValue(makeConnection({ policy_yaml: ': invalid [[[' }));

    const result = await handleToolCall('test_tool', { query: 'test' }, makeRegisteredTool());

    expect(result.content[0].text).toBe('Error: Invalid policy configuration');
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        deny_reason: 'Invalid policy configuration',
      }),
    );
  });

  it('returns denied and audits when policy denies request', async () => {
    mockedGetConn.mockReturnValue(makeConnection());

    const registered = makeRegisteredTool({ policyOperation: 'denied_op' });
    const result = await handleToolCall('test_tool', { query: 'test' }, registered);

    expect(result.content[0].text).toContain('Denied:');
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'denied',
      }),
    );
  });

  it('calls provider.execute() and audits on allowed request', async () => {
    const provider = makeProvider();
    mockedGetConn.mockReturnValue(makeConnection());
    mockedGetProvider.mockReturnValue(provider);

    const result = await handleToolCall('test_tool', { query: 'hello' }, makeRegisteredTool());

    expect(result.content[0].text).toContain('mock result');
    expect(provider.execute).toHaveBeenCalled();
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'allowed',
      }),
    );
  });

  it('strips unknown params not in inputSchema', async () => {
    const provider = makeProvider();
    mockedGetConn.mockReturnValue(makeConnection());
    mockedGetProvider.mockReturnValue(provider);

    await handleToolCall(
      'test_tool',
      { query: 'hello', unknown_field: 'should_be_stripped' },
      makeRegisteredTool(),
    );

    const executeCall = (provider.execute as ReturnType<typeof vi.fn>).mock.calls[0];
    const executedParams = executeCall[1];
    expect(executedParams).not.toHaveProperty('unknown_field');
    expect(executedParams).toHaveProperty('query', 'hello');
  });

  it('applies field policy (allowed_fields)', async () => {
    const provider = makeProvider();
    mockedGetConn.mockReturnValue(makeConnection());
    mockedGetProvider.mockReturnValue(provider);

    const registered = makeRegisteredTool({ policyOperation: 'field_policy_op' });
    await handleToolCall(
      'test_tool',
      { name: 'John', email: 'john@example.com', query: 'search' },
      registered,
    );

    const executeCall = (provider.execute as ReturnType<typeof vi.fn>).mock.calls[0];
    const executedParams = executeCall[1];
    expect(executedParams).toHaveProperty('name', 'John');
    expect(executedParams).toHaveProperty('email', 'john@example.com');
    expect(executedParams).not.toHaveProperty('query');
  });

  it('applies mutations before execution', async () => {
    const provider = makeProvider();
    mockedGetConn.mockReturnValue(makeConnection());
    mockedGetProvider.mockReturnValue(provider);

    const registered = makeRegisteredTool({ policyOperation: 'mutated_op' });
    await handleToolCall(
      'test_tool',
      { query: 'hello' },
      registered,
    );

    const executeCall = (provider.execute as ReturnType<typeof vi.fn>).mock.calls[0];
    const executedParams = executeCall[1];
    expect(executedParams).toHaveProperty('visibility', 'private');
  });

  it('sanitizes upstream error and logs raw error', async () => {
    const provider = makeProvider({
      execute: vi.fn(async () => { throw new Error('Something went wrong on the server'); }),
    });
    mockedGetConn.mockReturnValue(makeConnection());
    mockedGetProvider.mockReturnValue(provider);

    const result = await handleToolCall('test_tool', { query: 'hello' }, makeRegisteredTool());

    // Agent sees generic message, not raw error
    expect(result.content[0].text).toContain('Error:');
    expect(result.content[0].text).not.toContain('Something went wrong on the server');
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
      }),
    );
  });

  it('refreshes credentials on 401 and retries', async () => {
    let callCount = 0;
    const provider = makeProvider({
      execute: vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error('401 Unauthorized');
        return { data: 'refreshed result' };
      }),
      refreshCredentials: vi.fn(async () => ({
        access_token: 'new_token',
        refresh_token: 'new_refresh',
      })),
    });
    mockedGetConn.mockReturnValue(makeConnection());
    mockedGetProvider.mockReturnValue(provider);

    const result = await handleToolCall('test_tool', { query: 'hello' }, makeRegisteredTool());

    expect(result.content[0].text).toContain('refreshed result');
    expect(provider.refreshCredentials).toHaveBeenCalled();
    expect(mockedUpdateCreds).toHaveBeenCalledWith('conn_test123', {
      access_token: 'new_token',
      refresh_token: 'new_refresh',
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'allowed',
      }),
    );
  });

  it('returns definitive error when refresh permanently fails with auth error', async () => {
    const provider = makeProvider({
      execute: vi.fn(async () => { throw new Error('401 Unauthorized'); }),
      refreshCredentials: vi.fn(async () => { throw new Error('invalid_grant: Token has been revoked'); }),
    });
    mockedGetConn.mockReturnValue(makeConnection());
    mockedGetProvider.mockReturnValue(provider);

    const result = await handleToolCall('test_tool', { query: 'hello' }, makeRegisteredTool());

    expect(result.content[0].text).toContain('Authentication failed for test_tool');
    expect(result.content[0].text).toContain('needs to be re-authorized');
    expect(mockedSetNeedsReauth).toHaveBeenCalledWith('conn_test123', true);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        deny_reason: expect.stringContaining('Authentication permanently failed'),
      }),
    );
  });

  it('returns error when constraint fails', async () => {
    mockedGetConn.mockReturnValue(makeConnection());

    const registered = makeRegisteredTool({ policyOperation: 'constrained_op' });
    const result = await handleToolCall(
      'test_tool',
      { calendarId: 'not_primary' },
      registered,
    );

    expect(result.content[0].text).toContain('Denied:');
    expect(result.content[0].text).toContain('must_equal');
  });
});
