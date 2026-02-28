import type { Provider } from './types.js';
import { getOAuthClientId, getOAuthClientSecret } from '../db/settings.js';
import { updateConnectionCredentials, setConnectionNeedsReauth } from '../db/connections.js';

const AUTH_ERROR_PATTERNS = ['invalid_grant', 'invalid_client', 'Token has been expired', '401'];

export function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return AUTH_ERROR_PATTERNS.some(p => err.message.includes(p));
}

// Per-connection mutex to prevent concurrent refresh races
const refreshLocks = new Map<string, Promise<Record<string, unknown>>>();

/**
 * Attempt to refresh credentials for a connection. Uses a per-connection
 * mutex so concurrent calls share the same refresh request.
 */
export async function refreshConnectionCredentials(
  connectionId: string,
  provider: Provider,
  credentials: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!provider.refreshCredentials) {
    throw new Error('Provider does not support credential refresh');
  }

  let refreshPromise = refreshLocks.get(connectionId);
  if (!refreshPromise) {
    const clientId = getOAuthClientId(provider);
    const clientSecret = getOAuthClientSecret(provider);
    refreshPromise = provider.refreshCredentials(
      credentials,
      { clientId: clientId ?? '', clientSecret: clientSecret ?? '' },
    ).finally(() => refreshLocks.delete(connectionId));
    refreshLocks.set(connectionId, refreshPromise);
  }

  try {
    const newCreds = await refreshPromise;
    updateConnectionCredentials(connectionId, newCreds);
    setConnectionNeedsReauth(connectionId, false);
    return newCreds;
  } catch (err) {
    if (isAuthError(err)) {
      setConnectionNeedsReauth(connectionId, true);
    }
    throw err;
  }
}
