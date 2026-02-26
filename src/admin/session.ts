import crypto from 'node:crypto';

interface Session {
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function createSession(): string {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, {
    expiresAt: Date.now() + SESSION_TTL,
  });
  return id;
}

export function validateSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// Clean up expired sessions periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(id);
  }
}, 60 * 1000);
cleanupInterval.unref();
