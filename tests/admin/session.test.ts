import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSession,
  validateSession,
  deleteSession,
  clearAllSessions,
} from '../../src/admin/session.js';

describe('Session management', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  it('createSession returns a 64-character hex string', () => {
    const sessionId = createSession();
    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('each session has a unique ID', () => {
    const sessions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      sessions.add(createSession());
    }
    expect(sessions.size).toBe(100);
  });

  it('validateSession returns true for a valid session', () => {
    const sessionId = createSession();
    expect(validateSession(sessionId)).toBe(true);
  });

  it('validateSession returns false for unknown session ID', () => {
    expect(validateSession('nonexistent')).toBe(false);
  });

  it('validateSession returns false for empty string', () => {
    expect(validateSession('')).toBe(false);
  });

  it('deleteSession invalidates the session', () => {
    const sessionId = createSession();
    expect(validateSession(sessionId)).toBe(true);

    deleteSession(sessionId);
    expect(validateSession(sessionId)).toBe(false);
  });

  it('deleteSession on non-existent session does not throw', () => {
    expect(() => deleteSession('nonexistent')).not.toThrow();
  });

  it('clearAllSessions invalidates all sessions', () => {
    const id1 = createSession();
    const id2 = createSession();
    const id3 = createSession();

    expect(validateSession(id1)).toBe(true);
    expect(validateSession(id2)).toBe(true);
    expect(validateSession(id3)).toBe(true);

    clearAllSessions();

    expect(validateSession(id1)).toBe(false);
    expect(validateSession(id2)).toBe(false);
    expect(validateSession(id3)).toBe(false);
  });

  it('expired sessions are rejected by validateSession', () => {
    vi.useFakeTimers();
    try {
      const sessionId = createSession();
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
      const sessionId = createSession();

      // Advance to 1 second before expiry
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1000);
      expect(validateSession(sessionId)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
