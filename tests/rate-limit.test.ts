import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '../src/rate-limit.js';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not rate limit until threshold is exceeded', () => {
    const limiter = createRateLimiter(3, 60_000);
    const key = '10.0.0.1';

    // First 3 failures should not trigger rate limiting
    expect(limiter.recordFailure(key)).toBe(false);
    expect(limiter.recordFailure(key)).toBe(false);
    expect(limiter.recordFailure(key)).toBe(false);

    // 4th failure exceeds the limit of 3
    expect(limiter.recordFailure(key)).toBe(true);
  });

  it('isLimited returns true after exceeding threshold', () => {
    const limiter = createRateLimiter(2, 60_000);
    const key = '10.0.0.2';

    expect(limiter.isLimited(key)).toBe(false);
    limiter.recordFailure(key);
    limiter.recordFailure(key);
    expect(limiter.isLimited(key)).toBe(false);
    limiter.recordFailure(key);
    expect(limiter.isLimited(key)).toBe(true);
  });

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter(1, 60_000);

    limiter.recordFailure('ip-a');
    limiter.recordFailure('ip-a');
    expect(limiter.isLimited('ip-a')).toBe(true);
    expect(limiter.isLimited('ip-b')).toBe(false);
  });

  it('clear removes tracking for a key', () => {
    const limiter = createRateLimiter(1, 60_000);
    const key = '10.0.0.3';

    limiter.recordFailure(key);
    limiter.recordFailure(key);
    expect(limiter.isLimited(key)).toBe(true);

    limiter.clear(key);
    expect(limiter.isLimited(key)).toBe(false);
  });

  it('attempts expire after the window passes', () => {
    const windowMs = 5_000;
    const limiter = createRateLimiter(2, windowMs);
    const key = '10.0.0.4';

    limiter.recordFailure(key);
    limiter.recordFailure(key);
    limiter.recordFailure(key);
    expect(limiter.isLimited(key)).toBe(true);

    // Advance past the window
    vi.advanceTimersByTime(windowMs + 1);
    expect(limiter.isLimited(key)).toBe(false);
  });

  it('sliding window drops old attempts while keeping recent ones', () => {
    const windowMs = 10_000;
    const limiter = createRateLimiter(3, windowMs);
    const key = '10.0.0.5';

    // Record 2 failures at t=0
    limiter.recordFailure(key);
    limiter.recordFailure(key);

    // Advance 6 seconds (still within window)
    vi.advanceTimersByTime(6_000);

    // Record 2 more failures at t=6s
    limiter.recordFailure(key);
    limiter.recordFailure(key);

    // At t=6s: we have 4 attempts in window (2 at t=0, 2 at t=6)
    // This exceeds limit of 3
    expect(limiter.isLimited(key)).toBe(true);

    // Advance to t=11s: the t=0 attempts expire
    vi.advanceTimersByTime(5_000);
    // Now only 2 attempts remain in window (from t=6s)
    expect(limiter.isLimited(key)).toBe(false);
  });

  it('clear on non-existent key does not throw', () => {
    const limiter = createRateLimiter(5, 60_000);
    expect(() => limiter.clear('nonexistent')).not.toThrow();
  });

  it('uses default values when no arguments provided', () => {
    const limiter = createRateLimiter();
    const key = '10.0.0.6';

    // Default is 10 attempts per 60 seconds
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure(key);
    }
    expect(limiter.isLimited(key)).toBe(false);

    // 11th triggers rate limiting
    limiter.recordFailure(key);
    expect(limiter.isLimited(key)).toBe(true);
  });
});
