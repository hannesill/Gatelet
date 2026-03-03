import type { Provider } from './types.js';
import { getOAuthClientId, getOAuthClientSecret } from '../db/settings.js';
import { updateConnectionCredentials, setConnectionNeedsReauth } from '../db/connections.js';

const AUTH_ERROR_PATTERNS = ['invalid_grant', 'invalid_client', 'Token has been expired', 'Invalid Credentials', '401'];

export function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // googleapis (gaxios) puts the HTTP status in err.code (string) / err.status (number)
  const code = (err as { code?: unknown }).code;
  const status = (err as { status?: unknown }).status;
  const codeNum = typeof code === 'string' ? parseInt(code, 10) : code;
  if (codeNum === 401 || codeNum === 403 || status === 401 || status === 403) return true;
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
