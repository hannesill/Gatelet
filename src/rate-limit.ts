/**
 * Simple in-memory sliding window rate limiter.
 * Tracks failed attempts per key (typically IP address).
 */
export interface RateLimiter {
  /** Record a failed attempt. Returns true if the key is now rate-limited. */
  recordFailure(key: string): boolean;
  /** Check if a key is currently rate-limited (without recording). */
  isLimited(key: string): boolean;
  /** Clear tracking for a key (e.g., on successful auth). */
  clear(key: string): void;
}

export function createRateLimiter(
  maxAttempts: number = 10,
  windowMs: number = 60 * 1000,
): RateLimiter {
  const attempts = new Map<string, number[]>();

  function prune(key: string): number[] {
    const now = Date.now();
    const times = (attempts.get(key) || []).filter(t => now - t < windowMs);
    if (times.length === 0) {
      attempts.delete(key);
      return [];
    }
    attempts.set(key, times);
    return times;
  }

  // Periodic cleanup to prevent memory growth
  const cleanup = setInterval(() => {
    for (const key of attempts.keys()) {
      prune(key);
    }
  }, windowMs);
  cleanup.unref();

  return {
    recordFailure(key: string): boolean {
      const times = prune(key);
      times.push(Date.now());
      attempts.set(key, times);
      return times.length > maxAttempts;
    },

    isLimited(key: string): boolean {
      return prune(key).length > maxAttempts;
    },

    clear(key: string): void {
      attempts.delete(key);
    },
  };
}
