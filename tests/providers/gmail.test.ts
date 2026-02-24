import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GmailProvider } from '../../src/providers/gmail/provider.js';

// Mock googleapis
vi.mock('googleapis', () => {
  const mockMessages = {
    list: vi.fn(),
    get: vi.fn(),
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

describe('GmailProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('provider metadata', () => {
    it('has correct id', () => {
      expect(provider.id).toBe('google_gmail');
    });

    it('has correct displayName', () => {
      expect(provider.displayName).toBe('Gmail');
    });

    it('has all 4 tools with correct names', () => {
      expect(provider.tools).toHaveLength(4);
      const names = provider.tools.map((t) => t.name);
      expect(names).toEqual([
        'gmail_search',
        'gmail_read_message',
        'gmail_create_draft',
        'gmail_list_drafts',
      ]);
    });

    it('has oauth config with Gmail scopes', () => {
      expect(provider.oauth).toBeDefined();
      expect(provider.oauth.authorizeUrl).toContain('accounts.google.com');
      expect(provider.oauth.tokenUrl).toContain('googleapis.com');
      expect(provider.oauth.scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
      expect(provider.oauth.scopes).toContain('https://www.googleapis.com/auth/gmail.compose');
      expect(provider.oauth.builtinClientId).toBeDefined();
      expect(provider.oauth.builtinClientSecret).toBeDefined();
      expect(provider.oauth.settingsKeyPrefix).toBe('google');
      expect(provider.oauth.extraAuthorizeParams).toEqual({ access_type: 'offline', prompt: 'consent' });
    });
  });

  describe('gmail_search', () => {
    it('returns parsed message summaries', async () => {
      (mockMessages.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          messages: [{ id: 'msg1', threadId: 't1' }],
          resultSizeEstimate: 1,
        },
      });
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          payload: {
            headers: [
              { name: 'From', value: 'alice@example.com' },
              { name: 'Subject', value: 'Hello' },
              { name: 'Date', value: 'Mon, 24 Feb 2026 10:00:00' },
            ],
          },
          snippet: 'Hello there',
          labelIds: ['INBOX', 'UNREAD'],
        },
      });

      const result = await provider.execute('gmail_search', { q: 'from:alice' }, creds) as any;
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        id: 'msg1',
        threadId: 't1',
        from: 'alice@example.com',
        subject: 'Hello',
        date: 'Mon, 24 Feb 2026 10:00:00',
        snippet: 'Hello there',
        labelIds: ['INBOX', 'UNREAD'],
      });
      expect(result.resultSizeEstimate).toBe(1);
    });

    it('respects maxResults parameter', async () => {
      (mockMessages.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { messages: [], resultSizeEstimate: 0 },
      });

      await provider.execute('gmail_search', { maxResults: 5 }, creds);
      expect(mockMessages.list).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 5 }),
      );
    });

    it('caps maxResults at 50', async () => {
      (mockMessages.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { messages: [], resultSizeEstimate: 0 },
      });

      await provider.execute('gmail_search', { maxResults: 100 }, creds);
      expect(mockMessages.list).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 50 }),
      );
    });

    it('handles empty result set', async () => {
      (mockMessages.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { messages: undefined, resultSizeEstimate: 0 },
      });

      const result = await provider.execute('gmail_search', {}, creds) as any;
      expect(result.messages).toEqual([]);
      expect(result.resultSizeEstimate).toBe(0);
    });

    it('passes q parameter to Gmail API when provided', async () => {
      (mockMessages.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { messages: [], resultSizeEstimate: 0 },
      });

      await provider.execute('gmail_search', { q: 'is:unread from:boss@corp.com' }, creds);
      expect(mockMessages.list).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'is:unread from:boss@corp.com' }),
      );
    });

    it('omits q when not provided (inbox listing)', async () => {
      (mockMessages.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { messages: [], resultSizeEstimate: 0 },
      });

      await provider.execute('gmail_search', {}, creds);
      expect(mockMessages.list).toHaveBeenCalledWith(
        expect.objectContaining({ q: undefined }),
      );
    });
  });

  describe('gmail_read_message', () => {
    it('returns parsed message with extracted headers and plaintext body', async () => {
      const bodyData = Buffer.from('Hello, this is the message body.').toString('base64url');
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'msg1',
          threadId: 't1',
          labelIds: ['INBOX'],
          snippet: 'Hello, this is the message',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'alice@example.com' },
              { name: 'To', value: 'bob@example.com' },
              { name: 'Cc', value: '' },
              { name: 'Subject', value: 'Test Subject' },
              { name: 'Date', value: 'Mon, 24 Feb 2026 10:00:00' },
            ],
            body: { data: bodyData },
          },
        },
      });

      const result = await provider.execute('gmail_read_message', { messageId: 'msg1' }, creds) as any;
      expect(result.id).toBe('msg1');
      expect(result.from).toBe('alice@example.com');
      expect(result.subject).toBe('Test Subject');
      expect(result.body).toBe('Hello, this is the message body.');
    });

    it('handles multipart messages (prefers text/plain)', async () => {
      const plainData = Buffer.from('Plain text body').toString('base64url');
      const htmlData = Buffer.from('<div>HTML body</div>').toString('base64url');
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'msg2',
          threadId: 't2',
          labelIds: ['INBOX'],
          snippet: 'Plain text body',
          payload: {
            mimeType: 'multipart/alternative',
            headers: [
              { name: 'From', value: 'alice@example.com' },
              { name: 'To', value: 'bob@example.com' },
              { name: 'Subject', value: 'Multipart' },
              { name: 'Date', value: 'Mon, 24 Feb 2026 10:00:00' },
            ],
            parts: [
              { mimeType: 'text/plain', body: { data: plainData } },
              { mimeType: 'text/html', body: { data: htmlData } },
            ],
          },
        },
      });

      const result = await provider.execute('gmail_read_message', { messageId: 'msg2' }, creds) as any;
      expect(result.body).toBe('Plain text body');
    });

    it('falls back to stripped HTML when no text/plain part', async () => {
      const htmlData = Buffer.from('<div>HTML <b>body</b></div>').toString('base64url');
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'msg3',
          threadId: 't3',
          labelIds: ['INBOX'],
          snippet: 'HTML body',
          payload: {
            mimeType: 'multipart/alternative',
            headers: [
              { name: 'From', value: 'alice@example.com' },
              { name: 'To', value: 'bob@example.com' },
              { name: 'Subject', value: 'HTML only' },
              { name: 'Date', value: 'Mon, 24 Feb 2026 10:00:00' },
            ],
            parts: [
              { mimeType: 'text/html', body: { data: htmlData } },
            ],
          },
        },
      });

      const result = await provider.execute('gmail_read_message', { messageId: 'msg3' }, creds) as any;
      expect(result.body).toBe('HTML body');
    });

    it('applies content filter guards (blocking)', async () => {
      const bodyData = Buffer.from('Your code is 123456').toString('base64url');
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'msg4',
          threadId: 't4',
          labelIds: ['INBOX'],
          snippet: 'Your code',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'noreply@accounts.google.com' },
              { name: 'To', value: 'bob@example.com' },
              { name: 'Subject', value: 'Your verification code' },
              { name: 'Date', value: 'Mon, 24 Feb 2026 10:00:00' },
            ],
            body: { data: bodyData },
          },
        },
      });

      const result = await provider.execute(
        'gmail_read_message',
        { messageId: 'msg4' },
        creds,
        { block_subjects: ['verification code'] },
      ) as any;

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('verification code');
    });

    it('applies content filter guards (redaction)', async () => {
      const bodyData = Buffer.from('SSN: 123-45-6789').toString('base64url');
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'msg5',
          threadId: 't5',
          labelIds: ['INBOX'],
          snippet: 'SSN info',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'alice@example.com' },
              { name: 'To', value: 'bob@example.com' },
              { name: 'Subject', value: 'Info' },
              { name: 'Date', value: 'Mon, 24 Feb 2026 10:00:00' },
            ],
            body: { data: bodyData },
          },
        },
      });

      const result = await provider.execute(
        'gmail_read_message',
        { messageId: 'msg5' },
        creds,
        { redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }] },
      ) as any;

      expect(result.body).toBe('SSN: [REDACTED-SSN]');
    });

    it('returns blocked response for sender domain match', async () => {
      const bodyData = Buffer.from('Security alert').toString('base64url');
      (mockMessages.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'msg6',
          threadId: 't6',
          labelIds: ['INBOX'],
          snippet: 'Security',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'noreply@no-reply.accounts.google.com' },
              { name: 'To', value: 'bob@example.com' },
              { name: 'Subject', value: 'Security alert' },
              { name: 'Date', value: 'Mon, 24 Feb 2026 10:00:00' },
            ],
            body: { data: bodyData },
          },
        },
      });

      const result = await provider.execute(
        'gmail_read_message',
        { messageId: 'msg6' },
        creds,
        { block_sender_domains: ['no-reply.accounts.google.com'] },
      ) as any;

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('no-reply.accounts.google.com');
    });
  });

  describe('gmail_create_draft', () => {
    it('creates draft with correct RFC 2822 headers', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'draft1',
          message: { id: 'msg1', threadId: 't1' },
        },
      });

      const result = await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Meeting notes',
        body: 'Here are the notes.',
      }, creds) as any;

      expect(result.draftId).toBe('draft1');
      expect(result.messageId).toBe('msg1');
      expect(result.threadId).toBe('t1');

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      expect(raw).toContain('To: alice@example.com');
      expect(raw).toContain('Subject: Meeting notes');
      expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
      expect(raw).toContain('Here are the notes.');
    });

    it('includes CC header when provided', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'draft2', message: { id: 'msg2' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        cc: 'charlie@example.com',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      expect(raw).toContain('Cc: charlie@example.com');
    });

    it('includes BCC header when provided', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'draft3', message: { id: 'msg3' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        bcc: 'secret@example.com',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      expect(raw).toContain('Bcc: secret@example.com');
    });

    it('includes In-Reply-To header when provided', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'draft4', message: { id: 'msg4' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Re: Test',
        body: 'Reply body',
        inReplyTo: '<original@example.com>',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const raw = Buffer.from(call.requestBody.message.raw, 'base64url').toString('utf-8');
      expect(raw).toContain('In-Reply-To: <original@example.com>');
    });

    it('associates draft with threadId when provided', async () => {
      (mockDrafts.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'draft5', message: { id: 'msg5', threadId: 'thread1' } },
      });

      await provider.execute('gmail_create_draft', {
        to: 'alice@example.com',
        subject: 'Re: Test',
        body: 'Reply',
        threadId: 'thread1',
      }, creds);

      const call = (mockDrafts.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.requestBody.message.threadId).toBe('thread1');
    });
  });

  describe('gmail_list_drafts', () => {
    it('returns draft summaries', async () => {
      (mockDrafts.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          drafts: [{ id: 'draft1', message: { id: 'msg1' } }],
        },
      });
      (mockDrafts.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          message: {
            payload: {
              headers: [
                { name: 'To', value: 'alice@example.com' },
                { name: 'Subject', value: 'Draft subject' },
              ],
            },
            snippet: 'Draft content preview',
          },
        },
      });

      const result = await provider.execute('gmail_list_drafts', {}, creds) as any;
      expect(result.drafts).toHaveLength(1);
      expect(result.drafts[0]).toEqual({
        draftId: 'draft1',
        messageId: 'msg1',
        to: 'alice@example.com',
        subject: 'Draft subject',
        snippet: 'Draft content preview',
      });
    });

    it('respects and caps maxResults', async () => {
      (mockDrafts.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { drafts: [] },
      });

      await provider.execute('gmail_list_drafts', { maxResults: 100 }, creds);
      expect(mockDrafts.list).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 50 }),
      );
    });

    it('handles empty draft list', async () => {
      (mockDrafts.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { drafts: undefined },
      });

      const result = await provider.execute('gmail_list_drafts', {}, creds) as any;
      expect(result.drafts).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws on unknown tool name', async () => {
      await expect(
        provider.execute('gmail_send_message', {}, creds),
      ).rejects.toThrow('Unknown tool: gmail_send_message');
    });
  });

  describe('oauth', () => {
    it('discoverAccount returns email address', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ emailAddress: 'user@gmail.com' }),
      });

      const account = await provider.oauth.discoverAccount('test-token');
      expect(account).toBe('user@gmail.com');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('gmail/v1/users/me/profile');
      expect(fetchCall[1].headers.Authorization).toBe('Bearer test-token');
    });

    it('discoverAccount returns unknown on API error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const account = await provider.oauth.discoverAccount('bad-token');
      expect(account).toBe('unknown');
    });
  });
});
