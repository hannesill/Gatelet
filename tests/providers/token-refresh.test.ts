import { describe, it, expect } from 'vitest';
import { isAuthError } from '../../src/providers/token-refresh.js';

describe('isAuthError', () => {
  it('detects GaxiosError-style errors with code: 401', () => {
    const err = Object.assign(new Error('Invalid Credentials'), { code: 401 });
    expect(isAuthError(err)).toBe(true);
  });

  it('detects errors with code: 403', () => {
    const err = Object.assign(new Error('Forbidden'), { code: 403 });
    expect(isAuthError(err)).toBe(true);
  });

  it('detects string code "401" (gaxios types code as string)', () => {
    const err = Object.assign(new Error('Invalid Credentials'), { code: '401' });
    expect(isAuthError(err)).toBe(true);
  });

  it('detects errors with status: 401', () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    expect(isAuthError(err)).toBe(true);
  });

  it('detects errors with status: 403', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    expect(isAuthError(err)).toBe(true);
  });

  it('detects invalid_grant in message', () => {
    expect(isAuthError(new Error('invalid_grant: Token has been revoked'))).toBe(true);
  });

  it('detects Invalid Credentials in message', () => {
    expect(isAuthError(new Error('Invalid Credentials'))).toBe(true);
  });

  it('detects 401 in message', () => {
    expect(isAuthError(new Error('Request failed with status 401'))).toBe(true);
  });

  it('rejects non-auth errors', () => {
    const err = Object.assign(new Error('Something else'), { code: 500 });
    expect(isAuthError(err)).toBe(false);
  });

  it('rejects non-Error values', () => {
    expect(isAuthError('401')).toBe(false);
    expect(isAuthError(401)).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});
