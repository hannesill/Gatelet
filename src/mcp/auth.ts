import { validateApiKey } from '../db/api-keys.js';
import { createRateLimiter } from '../rate-limit.js';

const limiter = createRateLimiter(10, 60 * 1000); // 10 failures per minute

/** Check if a client IP is currently rate-limited. */
export function isMcpRateLimited(clientIp: string): boolean {
  return limiter.isLimited(clientIp);
}

export function authenticateBearer(
  authHeader: string | undefined,
  clientIp?: string,
): { id: string; name: string } | null {
  const key = clientIp || 'unknown';

  if (limiter.isLimited(key)) {
    return null;
  }

  // Missing auth header entirely — not an attack, just unauthenticated.
  // Don't count against rate limiter (health probes, misconfigured clients).
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    limiter.recordFailure(key);
    return null;
  }

  const result = validateApiKey(match[1]);
  if (!result) {
    limiter.recordFailure(key);
    return null;
  }

  limiter.clear(key);
  return result;
}
