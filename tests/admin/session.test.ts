import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createSession,
  validateSession,
  deleteSession,
} from '../../src/admin/session.js';

describe('Session management', () => {
  // Track sessions created in each test so we can clean up
  const sessions: string[] = [];
  afterEach(() => {
    for (const id of sessions) deleteSession(id);
    sessions.length = 0;
  });

  function tracked() {
    const id = createSession();
    sessions.push(id);
    return id;
  }

  it('createSession returns a 64-character hex string', () => {
    const sessionId = tracked();
    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('each session has a unique ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(tracked());
    }
    expect(ids.size).toBe(100);
  });

  it('validateSession returns true for a valid session', () => {
    const sessionId = tracked();
    expect(validateSession(sessionId)).toBe(true);
  });

  it('validateSession returns false for unknown session ID', () => {
    expect(validateSession('nonexistent')).toBe(false);
  });

  it('validateSession returns false for empty string', () => {
    expect(validateSession('')).toBe(false);
  });

  it('deleteSession invalidates the session', () => {
    const sessionId = tracked();
    expect(validateSession(sessionId)).toBe(true);

    deleteSession(sessionId);
    expect(validateSession(sessionId)).toBe(false);
  });

  it('deleteSession on non-existent session does not throw', () => {
    expect(() => deleteSession('nonexistent')).not.toThrow();
  });

  it('expired sessions are rejected by validateSession', () => {
    vi.useFakeTimers();
    try {
      const sessionId = tracked();
      expect(validateSession(sessionId)).toBe(true);

      // Advance past 24-hour TTL
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
      expect(validateSession(sessionId)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('session created just before expiry is still valid', () => {
    vi.useFakeTimers();
    try {
      const sessionId = tracked();

      // Advance to 1 second before expiry
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1000);
      expect(validateSession(sessionId)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
