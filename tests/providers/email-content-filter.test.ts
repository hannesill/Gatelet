import { describe, it, expect } from 'vitest';
import { applyContentFilters, filterSearchResult } from '../../src/providers/email/content-filter.js';
import type { ParsedMessage, SearchResultSummary } from '../../src/providers/email/types.js';

function makeMessage(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    id: 'msg1',
    threadId: 'thread1',
    labelIds: ['INBOX'],
    from: 'Alice <alice@example.com>',
    to: 'bob@example.com',
    cc: '',
    subject: 'Hello there',
    date: 'Mon, 24 Feb 2026 10:00:00 +0100',
    body: 'This is a test message body.',
    snippet: 'This is a test message body.',
    hasAttachments: false,
    ...overrides,
  };
}

describe('applyContentFilters', () => {
  describe('subject blocking', () => {
    it('blocks message with matching subject (case-insensitive)', () => {
      const msg = makeMessage({ subject: 'Your Verification Code is 123456' });
      const result = applyContentFilters(msg, {
        block_subjects: ['verification code'],
      });
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('verification code');
      expect(result.messageId).toBe('msg1');
      expect(result.from).toBe('[blocked]');
      expect(result.subject).toBe('[blocked]');
      expect(result.snippet).toBe('[content hidden]');
    });

    it('allows message with non-matching subject', () => {
      const msg = makeMessage({ subject: 'Meeting tomorrow' });
      const result = applyContentFilters(msg, {
        block_subjects: ['verification code', 'password reset'],
      });
      expect(result.blocked).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.message!.subject).toBe('Meeting tomorrow');
    });

    it('matches partial subject (substring)', () => {
      const msg = makeMessage({ subject: 'Please reset your password now' });
      const result = applyContentFilters(msg, {
        block_subjects: ['reset your password'],
      });
      expect(result.blocked).toBe(true);
    });

    it('handles empty block_subjects list', () => {
      const msg = makeMessage();
      const result = applyContentFilters(msg, { block_subjects: [] });
      expect(result.blocked).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('sender domain blocking', () => {
    it('blocks message from matching sender domain', () => {
      const msg = makeMessage({ from: 'noreply@no-reply.accounts.google.com' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['no-reply.accounts.google.com'],
      });
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('no-reply.accounts.google.com');
    });

    it('extracts domain from full email address (Name <user@domain.com>)', () => {
      const msg = makeMessage({ from: 'Google Security <noreply@no-reply.accounts.google.com>' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['no-reply.accounts.google.com'],
      });
      expect(result.blocked).toBe(true);
    });

    it('case-insensitive domain match', () => {
      const msg = makeMessage({ from: 'user@NO-REPLY.ACCOUNTS.GOOGLE.COM' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['no-reply.accounts.google.com'],
      });
      expect(result.blocked).toBe(true);
    });

    it('handles empty block_sender_domains list', () => {
      const msg = makeMessage();
      const result = applyContentFilters(msg, { block_sender_domains: [] });
      expect(result.blocked).toBe(false);
    });

    it('does not block when sender domain does not match', () => {
      const msg = makeMessage({ from: 'alice@example.com' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['no-reply.accounts.google.com'],
      });
      expect(result.blocked).toBe(false);
    });
  });

  describe('PII redaction', () => {
    it('redacts SSN pattern', () => {
      const msg = makeMessage({ body: 'My SSN is 123-45-6789 please process.' });
      const result = applyContentFilters(msg, {
        redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }],
      });
      expect(result.blocked).toBe(false);
      expect(result.message!.body).toBe('My SSN is [REDACTED-SSN] please process.');
    });

    it('redacts credit card pattern', () => {
      const msg = makeMessage({ body: 'Card: 1234 5678 9012 3456 on file.' });
      const result = applyContentFilters(msg, {
        redact_patterns: [{ pattern: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b', replace: '[REDACTED-CC]' }],
      });
      expect(result.blocked).toBe(false);
      expect(result.message!.body).toBe('Card: [REDACTED-CC] on file.');
    });

    it('applies multiple patterns in sequence', () => {
      const msg = makeMessage({ body: 'SSN: 123-45-6789, Card: 1234567890123456' });
      const result = applyContentFilters(msg, {
        redact_patterns: [
          { pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' },
          { pattern: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b', replace: '[REDACTED-CC]' },
        ],
      });
      expect(result.message!.body).toBe('SSN: [REDACTED-SSN], Card: [REDACTED-CC]');
    });

    it('does not modify non-matching text', () => {
      const msg = makeMessage({ body: 'No sensitive data here.' });
      const result = applyContentFilters(msg, {
        redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }],
      });
      expect(result.message!.body).toBe('No sensitive data here.');
    });

    it('handles empty redact_patterns list', () => {
      const msg = makeMessage({ body: 'SSN: 123-45-6789' });
      const result = applyContentFilters(msg, { redact_patterns: [] });
      expect(result.message!.body).toBe('SSN: 123-45-6789');
    });

    it('invalid regex pattern does not crash (skips with warning)', () => {
      const msg = makeMessage({ body: 'Test body' });
      const result = applyContentFilters(msg, {
        redact_patterns: [{ pattern: '[invalid', replace: 'X' }],
      });
      expect(result.blocked).toBe(false);
      expect(result.message!.body).toBe('Test body');
    });
  });

  describe('combined behavior', () => {
    it('blocking takes priority over redaction', () => {
      const msg = makeMessage({
        subject: 'Your verification code',
        body: 'SSN: 123-45-6789',
      });
      const result = applyContentFilters(msg, {
        block_subjects: ['verification code'],
        redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }],
      });
      expect(result.blocked).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('when not blocked, all redaction patterns apply', () => {
      const msg = makeMessage({ body: 'SSN: 123-45-6789, Card: 1234 5678 9012 3456' });
      const result = applyContentFilters(msg, {
        block_subjects: ['verification code'],
        redact_patterns: [
          { pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' },
          { pattern: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b', replace: '[REDACTED-CC]' },
        ],
      });
      expect(result.blocked).toBe(false);
      expect(result.message!.body).toBe('SSN: [REDACTED-SSN], Card: [REDACTED-CC]');
    });

    it('no guards = message returned unmodified', () => {
      const msg = makeMessage({ body: 'SSN: 123-45-6789' });
      const result = applyContentFilters(msg, {});
      expect(result.blocked).toBe(false);
      expect(result.message!.body).toBe('SSN: 123-45-6789');
    });
  });

  describe('domain suffix matching', () => {
    it('blocks subdomain of a blocked domain', () => {
      const msg = makeMessage({ from: 'noreply@mail.accounts.google.com' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['accounts.google.com'],
      });
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('accounts.google.com');
    });

    it('blocks deeply nested subdomain', () => {
      const msg = makeMessage({ from: 'noreply@a.b.c.accounts.google.com' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['accounts.google.com'],
      });
      expect(result.blocked).toBe(true);
    });

    it('does not block partial domain name match', () => {
      const msg = makeMessage({ from: 'user@notaccounts.google.com' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['accounts.google.com'],
      });
      expect(result.blocked).toBe(false);
    });

    it('still matches exact domain', () => {
      const msg = makeMessage({ from: 'user@accounts.google.com' });
      const result = applyContentFilters(msg, {
        block_sender_domains: ['accounts.google.com'],
      });
      expect(result.blocked).toBe(true);
    });
  });

  describe('snippet redaction', () => {
    it('redacts patterns in snippet via applyContentFilters', () => {
      const msg = makeMessage({
        body: 'SSN: 123-45-6789',
        snippet: 'SSN: 123-45-6789',
      });
      const result = applyContentFilters(msg, {
        redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }],
      });
      expect(result.blocked).toBe(false);
      expect(result.message!.body).toBe('SSN: [REDACTED-SSN]');
      expect(result.message!.snippet).toBe('SSN: [REDACTED-SSN]');
    });

    it('does not modify snippet when no patterns match', () => {
      const msg = makeMessage({
        body: 'No sensitive data',
        snippet: 'No sensitive data',
      });
      const result = applyContentFilters(msg, {
        redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }],
      });
      expect(result.message!.snippet).toBe('No sensitive data');
    });
  });
});

function makeSearchResult(overrides: Partial<SearchResultSummary> = {}): SearchResultSummary {
  return {
    id: 'msg1',
    threadId: 'thread1',
    from: 'Alice <alice@example.com>',
    subject: 'Hello there',
    date: 'Mon, 24 Feb 2026 10:00:00 +0100',
    snippet: 'This is a search result snippet.',
    labelIds: ['INBOX'],
    ...overrides,
  };
}

describe('filterSearchResult', () => {
  it('filters result with blocked subject', () => {
    const result = filterSearchResult(
      makeSearchResult({ subject: 'Your Verification Code' }),
      { block_subjects: ['verification code'] },
    );
    expect(result.from).toBe('[filtered]');
    expect(result.subject).toBe('[filtered]');
    expect(result.snippet).toBe('[content hidden]');
  });

  it('filters result with blocked sender domain', () => {
    const result = filterSearchResult(
      makeSearchResult({ from: 'noreply@accounts.google.com' }),
      { block_sender_domains: ['accounts.google.com'] },
    );
    expect(result.from).toBe('[filtered]');
    expect(result.subject).toBe('[filtered]');
    expect(result.snippet).toBe('[content hidden]');
  });

  it('filters result with blocked sender subdomain', () => {
    const result = filterSearchResult(
      makeSearchResult({ from: 'noreply@mail.accounts.google.com' }),
      { block_sender_domains: ['accounts.google.com'] },
    );
    expect(result.from).toBe('[filtered]');
    expect(result.snippet).toBe('[content hidden]');
  });

  it('redacts snippet patterns for non-blocked results', () => {
    const result = filterSearchResult(
      makeSearchResult({ snippet: 'SSN: 123-45-6789 in message' }),
      { redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }] },
    );
    expect(result.snippet).toBe('SSN: [REDACTED-SSN] in message');
    expect(result.from).toBe('Alice <alice@example.com>');
    expect(result.subject).toBe('Hello there');
  });

  it('returns unchanged result with empty guards', () => {
    const original = makeSearchResult();
    const result = filterSearchResult(original, {});
    expect(result.from).toBe('Alice <alice@example.com>');
    expect(result.subject).toBe('Hello there');
    expect(result.snippet).toBe('This is a search result snippet.');
  });

  it('preserves id, threadId, date, and labelIds', () => {
    const result = filterSearchResult(
      makeSearchResult({ subject: 'Your OTP code' }),
      { block_subjects: ['OTP'] },
    );
    expect(result.id).toBe('msg1');
    expect(result.threadId).toBe('thread1');
    expect(result.date).toBe('Mon, 24 Feb 2026 10:00:00 +0100');
    expect(result.labelIds).toEqual(['INBOX']);
  });
});
