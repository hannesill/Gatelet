import { Hono } from 'hono';
import { listConnections, getConnectionWithCredentials } from '../../db/connections.js';
import { listApiKeys } from '../../db/api-keys.js';
import { getProvider, getAllProviders } from '../../providers/registry.js';
import { parsePolicy } from '../../policy/parser.js';
import { getSetting, setSetting, getOAuthClientId, getOAuthClientSecret, getOAuthCredentialSource } from '../../db/settings.js';
import { startTime } from '../../start-time.js';
import { config } from '../../config.js';

interface ConnectionWithMeta {
  id: string;
  provider_id: string;
  account_name: string;
  displayName: string;
  enabledTools: number;
  totalTools: number;
  tokenStatus: 'valid' | 'expired' | 'unknown';
  tokenExpiresAt?: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

function getTokenInfo(connectionId: string): { status: 'valid' | 'expired' | 'unknown'; expiresAt?: number } {
  try {
    const conn = getConnectionWithCredentials(connectionId);
    if (!conn?.credentials) return { status: 'unknown' };
    const expiry = conn.credentials.expiry_date;
    if (typeof expiry !== 'number') return { status: 'unknown' };
    return { status: expiry > Date.now() ? 'valid' : 'expired', expiresAt: expiry };
  } catch {
    return { status: 'unknown' };
  }
}

const app = new Hono();

app.get('/status', (c) => {
  const connections = listConnections();
  const apiKeys = listApiKeys();

  const connectionsWithMeta: ConnectionWithMeta[] = connections.map(conn => {
    const provider = getProvider(conn.provider_id);
    const totalTools = provider?.tools.length ?? 0;

    let enabledTools = 0;
    try {
      const { policy } = parsePolicy(conn.policy_yaml);
      enabledTools = Object.values(policy.operations).filter(op => op.allow).length;
    } catch {
      // Invalid policy — 0 enabled tools
    }

    const tokenInfo = getTokenInfo(conn.id);

    return {
      id: conn.id,
      provider_id: conn.provider_id,
      account_name: conn.account_name,
      displayName: provider?.displayName ?? conn.provider_id,
      enabledTools,
      totalTools,
      tokenStatus: tokenInfo.status,
      tokenExpiresAt: tokenInfo.expiresAt,
      enabled: conn.enabled !== 0,
      created_at: conn.created_at,
      updated_at: conn.updated_at,
    };
  });

  const totalKeys = apiKeys.length;
  const activeKeys = apiKeys.filter(k => !k.revoked_at).length;

  const tools = connections.flatMap(conn => {
    const provider = getProvider(conn.provider_id);
    if (!provider) return [];
    try {
      const { policy } = parsePolicy(conn.policy_yaml);
      return provider.tools.map(t => ({
        name: t.name,
        operation: t.policyOperation,
        enabled: !!policy.operations[t.policyOperation]?.allow,
        connectionId: conn.id,
        providerId: conn.provider_id,
      }));
    } catch {
      return [];
    }
  });

  const oauthProviders = getAllProviders()
    .filter(p => p.oauth)
    .map(p => ({
      id: p.id,
      displayName: p.displayName,
      configured: !!(getOAuthClientId(p) && getOAuthClientSecret(p)),
      credentialSource: getOAuthCredentialSource(p),
    }));

  // setup_completed: explicit setting > fallback for upgrades (has connections or keys)
  const setupSetting = getSetting('setup_completed');
  const setupCompleted = setupSetting !== null
    ? setupSetting === 'true'
    : connections.length > 0 || activeKeys > 0;

  return c.json({
    uptime: Date.now() - startTime,
    connections: connectionsWithMeta,
    tools,
    apiKeys: { total: totalKeys, active: activeKeys },
    oauthProviders,
    setupCompleted,
    runtime: {
      docker: config.IS_DOCKER,
    },
  });
});

app.post('/setup-status', async (c) => {
  const body = await c.req.json<{ completed: boolean }>();
  if (typeof body.completed !== 'boolean') {
    return c.json({ error: 'completed must be a boolean' }, 400);
  }
  setSetting('setup_completed', String(body.completed));
  return c.json({ ok: true });
});

export default app;
