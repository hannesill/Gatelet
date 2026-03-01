import { describe, it, expect } from 'vitest';
import { sanitizeUpstreamError } from '../../src/mcp/error-sanitizer.js';

describe('sanitizeUpstreamError', () => {
  it('classifies 401/auth errors', () => {
    const result = sanitizeUpstreamError(
      new Error('Request failed with status code 401 Unauthorized'),
      'list_events',
    );
    expect(result.agentMessage).toContain('Authentication error');
    expect(result).not.toHaveProperty('retryable');
    expect(result.logMessage).toContain('401');
  });

  it('classifies invalid_grant errors', () => {
    const result = sanitizeUpstreamError(
      new Error('invalid_grant: Token has been expired or revoked'),
      'list_events',
    );
    expect(result.agentMessage).toContain('Authentication error');
    expect(result).not.toHaveProperty('retryable');
  });

  it('classifies 403/permission errors', () => {
    const result = sanitizeUpstreamError(
      new Error('Forbidden: 403 insufficient permission for this resource'),
      'create_event',
    );
    expect(result.agentMessage).toContain('Permission denied');
    expect(result).not.toHaveProperty('retryable');
  });

  it('classifies 404/not found errors', () => {
    const result = sanitizeUpstreamError(
      new Error('Not Found: 404 - The calendar does not exist'),
      'get_event',
    );
    expect(result.agentMessage).toContain('Resource not found');
    expect(result.agentMessage).toContain('Verify the ID is correct');
    expect(result).not.toHaveProperty('retryable');
  });

  it('classifies 429/rate limit errors', () => {
    const result = sanitizeUpstreamError(
      new Error('429 Too Many Requests: Rate limit exceeded'),
      'list_events',
    );
    expect(result.agentMessage).toContain('Rate limit');
    expect(result).not.toHaveProperty('retryable');
  });

  it('classifies quota errors as rate limit', () => {
    const result = sanitizeUpstreamError(
      new Error('Quota exceeded for project my-project-12345'),
      'create_event',
    );
    expect(result.agentMessage).toContain('Rate limit');
    expect(result).not.toHaveProperty('retryable');
  });

  it('classifies 400/validation errors', () => {
    const result = sanitizeUpstreamError(
      new Error('400 Bad Request: Required field "summary" is missing'),
      'create_event',
    );
    expect(result.agentMessage).toContain('Invalid request');
    expect(result.agentMessage).toContain("'summary'");
    expect(result).not.toHaveProperty('retryable');
  });

  it('classifies 400/validation errors without field name', () => {
    const result = sanitizeUpstreamError(
      new Error('400 Bad Request: invalid payload'),
      'create_event',
    );
    expect(result.agentMessage).toContain('Invalid request');
    expect(result.agentMessage).toContain('Double-check required fields');
    expect(result).not.toHaveProperty('retryable');
  });

  it('returns generic message for unknown errors', () => {
    const result = sanitizeUpstreamError(
      new Error('ECONNRESET: socket hang up'),
      'list_events',
    );
    expect(result.agentMessage).toContain('unexpected error');
    expect(result.agentMessage).toContain('Try the request again');
    expect(result).not.toHaveProperty('retryable');
  });

  it('does not leak sensitive info in agentMessage', () => {
    const result = sanitizeUpstreamError(
      new Error('Request to https://internal-api.google.com/v3/projects/my-secret-project-12345/calendars failed with 500: Internal server error, request-id: abc-123-def'),
      'list_events',
    );
    expect(result.agentMessage).not.toContain('my-secret-project');
    expect(result.agentMessage).not.toContain('abc-123-def');
    expect(result.agentMessage).not.toContain('internal-api.google.com');
    // But logMessage should have the full details
    expect(result.logMessage).toContain('my-secret-project');
    expect(result.logMessage).toContain('abc-123-def');
  });

  it('logMessage always contains full original error', () => {
    const originalMsg = 'Detailed error with project_id=12345 and request_id=abc';
    const result = sanitizeUpstreamError(new Error(originalMsg), 'test_tool');
    expect(result.logMessage).toContain(originalMsg);
    expect(result.logMessage).toContain('[test_tool]');
  });

  it('handles non-Error thrown values (string)', () => {
    const result = sanitizeUpstreamError('raw string error', 'test_tool');
    expect(result.logMessage).toContain('raw string error');
    expect(result.agentMessage).toBeDefined();
  });
});
