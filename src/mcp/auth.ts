import { validateApiKey } from '../db/api-keys.js';

export function authenticateBearer(
  authHeader: string | undefined,
): { id: string; name: string } | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  return validateApiKey(match[1]);
}
