import { validateApiKey } from '../db/api-keys.js';
import { createRateLimiter } from '../rate-limit.js';

const limiter = createRateLimiter(10, 60 * 1000); // 10 failures per minute

export function authenticateBearer(
  authHeader: string | undefined,
  clientIp?: string,
): { id: string; name: string } | null {
  const key = clientIp || 'unknown';

  if (limiter.isLimited(key)) {
    return null;
  }

  if (!authHeader) {
    limiter.recordFailure(key);
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
