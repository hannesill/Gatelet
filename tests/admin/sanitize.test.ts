import { describe, it, expect } from 'vitest';
import { stripSensitivePatterns } from '../../src/admin/routes/sanitize.js';

describe('stripSensitivePatterns', () => {
  it('redacts Google OAuth access tokens (ya29.*)', () => {
    const msg = 'Request failed: invalid token ya29.a0ARrdaM_something-long_here';
    expect(stripSensitivePatterns(msg)).toBe('Request failed: invalid token [REDACTED_TOKEN]');
  });

  it('redacts JWTs', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJhY2NvdW50cyJ9.signature_here';
    const msg = `Token exchange failed: ${jwt}`;
    expect(stripSensitivePatterns(msg)).toBe('Token exchange failed: [REDACTED_JWT]');
  });

  it('redacts Bearer token values', () => {
    const msg = 'Authorization: Bearer abc123def456';
    expect(stripSensitivePatterns(msg)).toBe('Authorization: Bearer [REDACTED]');
  });

  it('redacts Bearer case-insensitively', () => {
    const msg = 'header was bearer SECRETTOKEN';
    expect(stripSensitivePatterns(msg)).toBe('header was bearer [REDACTED]');
  });

  it('redacts access_token in query strings', () => {
    const msg = 'Error at https://api.example.com?access_token=secret123&other=value';
    expect(stripSensitivePatterns(msg)).toContain('access_token=[REDACTED]');
    expect(stripSensitivePatterns(msg)).not.toContain('secret123');
  });

  it('redacts refresh_token in form bodies', () => {
    const msg = 'Token refresh failed: refresh_token=1//0abc-def_ghiXYZ';
    expect(stripSensitivePatterns(msg)).toContain('refresh_token=[REDACTED]');
    expect(stripSensitivePatterns(msg)).not.toContain('1//0abc');
  });

  it('redacts client_secret', () => {
    const msg = 'OAuth error: client_secret=GOCSPX-abcdef123456';
    expect(stripSensitivePatterns(msg)).toContain('client_secret=[REDACTED]');
    expect(stripSensitivePatterns(msg)).not.toContain('GOCSPX');
  });

  it('redacts access_token with colon-space separator', () => {
    const msg = 'access_token: ya29.something_secret';
    const result = stripSensitivePatterns(msg);
    expect(result).not.toContain('ya29.something_secret');
  });

  it('handles multiple sensitive values in one message', () => {
    const msg = 'Failed: Bearer tok123 with refresh_token=rt_456 and client_secret=cs_789';
    const result = stripSensitivePatterns(msg);
    expect(result).not.toContain('tok123');
    expect(result).not.toContain('rt_456');
    expect(result).not.toContain('cs_789');
  });

  it('leaves non-sensitive messages unchanged', () => {
    const msg = 'Connection timed out after 30000ms';
    expect(stripSensitivePatterns(msg)).toBe(msg);
  });

  it('leaves normal error messages intact around redactions', () => {
    const msg = 'Google API returned 401: invalid_grant for refresh_token=old_token';
    const result = stripSensitivePatterns(msg);
    expect(result).toContain('Google API returned 401: invalid_grant');
    expect(result).not.toContain('old_token');
  });
});
