/**
 * Tests for Gmail email header injection prevention.
 *
 * The GmailProvider constructs RFC 2822 email messages from agent-supplied
 * parameters. Without sanitization, a malicious agent could inject additional
 * headers via CRLF sequences in the to, subject, cc, or bcc fields.
 *
 * The sanitizeHeader() function strips \r and \n to prevent this.
 * These tests verify the sanitization is applied in all code paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GmailProvider } from '../../src/providers/gmail/provider.js';

// Mock googleapis
vi.mock('googleapis', () => {
  const mockMessages = {
    list: vi.fn(),
    get: vi.fn(),
    send: vi.fn(),
    modify: vi.fn(),
  };
  const mockDrafts = {
    create: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  };

  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn(),
          refreshAccessToken: vi.fn(),
        })),
      },
      gmail: vi.fn(() => ({
        users: {
          messages: mockMessages,
          drafts: mockDrafts,
        },
      })),
    },
    _mockMessages: mockMessages,
    _mockDrafts: mockDrafts,
  };
});

import { _mockMessages as mockMessages, _mockDrafts as mockDrafts } from 'googleapis';

const provider = new GmailProvider();
const creds = { access_token: 'tok', refresh_token: 'ref' };

describe('Gmail header injection prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gmail_create_draft', () => {
    it('strips CRLF from "to" field to prevent header injection', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'd1', message: { id: 'm1' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'victim@example.com\r\nBcc: evil@attacker.com',
        subject: 'Test',
        body: 'Body',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      // The CRLF is stripped so "Bcc:" is NOT a separate header line.
      // Instead it is concatenated into the To value (harmless junk).
      expect(raw).not.toMatch(/^Bcc: evil@attacker\.com$/m);
      // Verify the text was collapsed into the To header value
      expect(raw).toContain('To: victim@example.comBcc: evil@attacker.com');
    });

    it('strips CRLF from "subject" field', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'd2', message: { id: 'm2' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Normal\r\nBcc: evil@attacker.com',
        body: 'Body',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      // The \r\n is stripped, so Bcc is collapsed into the subject line
      expect(raw).not.toMatch(/^Bcc: evil@attacker\.com$/m);
    });

    it('strips CRLF from "cc" field', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'd3', message: { id: 'm3' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        cc: 'bob@example.com\r\nBcc: evil@attacker.com',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      // Injected Bcc should not appear as a separate header line
      expect(raw).not.toMatch(/^Bcc: evil@attacker\.com$/m);
    });

    it('strips CRLF from "bcc" field', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'd4', message: { id: 'm4' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        bcc: 'legitimate@example.com\r\nX-Injected: true',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      expect(raw).not.toMatch(/^X-Injected: true$/m);
    });
  });

  describe('gmail_send', () => {
    it('strips CRLF from "to" field in send', async () => {
      (mockMessages.send as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 's1', threadId: 't1', labelIds: ['SENT'] },
      });

      await provider.execute('gmail_send', {
        to: 'victim@example.com\r\nBcc: evil@attacker.com',
        subject: 'Test',
        body: 'Body',
      }, creds);

      const call = (mockMessages.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.raw, 'base64url').toString('utf-8');
      expect(raw).not.toMatch(/^Bcc: evil@attacker\.com$/m);
    });

    it('strips CRLF from explicit "from" field in send', async () => {
      (mockMessages.send as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 's2', threadId: 't2', labelIds: ['SENT'] },
      });

      await provider.execute('gmail_send', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        from: 'me@example.com\r\nBcc: evil@attacker.com',
      }, creds);

      const call = (mockMessages.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.raw, 'base64url').toString('utf-8');
      expect(raw).not.toMatch(/^Bcc: evil@attacker\.com$/m);
    });
  });

  describe('gmail_reply', () => {
    it('strips CRLF from original message headers used in reply', async () => {
      // Even though original message headers come from Gmail API (trusted),
      // sanitizeHeader is still applied for defense in depth.
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'orig1',
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'From', value: 'alice@example.com\r\nX-Inject: true' },
              { name: 'To', value: 'me@example.com' },
              { name: 'Subject', value: 'Test\r\nBcc: evil@attacker.com' },
              { name: 'Message-ID', value: '<orig@example.com>' },
            ],
          },
        },
      });
      (mockMessages.send as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'reply1', threadId: 'thread1', labelIds: ['SENT'] },
      });

      await provider.execute('gmail_reply', {
        messageId: 'orig1',
        body: 'Reply body',
      }, creds);

      const call = (mockMessages.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.raw, 'base64url').toString('utf-8');
      expect(raw).not.toMatch(/^X-Inject: true$/m);
      expect(raw).not.toMatch(/^Bcc: evil@attacker\.com$/m);
    });
  });
});
