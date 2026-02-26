/** Strip OAuth tokens, bearer tokens, and secrets from error messages for admin display. */
export function stripSensitivePatterns(msg: string): string {
  return msg
    // Google OAuth tokens (ya29.*)
    .replace(/\b(ya29\.[A-Za-z0-9_-]+)/g, '[REDACTED_TOKEN]')
    // JWTs (three base64url segments separated by dots)
    .replace(/\b(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g, '[REDACTED_JWT]')
    // Bearer token values
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    // Token key=value pairs in URLs or form bodies
    .replace(/(access_token[=:]\s*)[^\s&"']+/gi, '$1[REDACTED]')
    .replace(/(refresh_token[=:]\s*)[^\s&"']+/gi, '$1[REDACTED]')
    .replace(/(client_secret[=:]\s*)[^\s&"']+/gi, '$1[REDACTED]');
}
