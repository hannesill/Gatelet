import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutlookMailProvider } from '../../src/providers/outlook-mail/provider.js';

const provider = new OutlookMailProvider();
const creds = { access_token: 'tok', refresh_token: 'ref' };

describe('OutlookMailProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(response: unknown, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    });
  }

  /** Mock fetch that returns 202 with no body (used by sendMail) */
  function mockFetch202() {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({}),
      text: async () => '',
    });
  }

  describe('provider metadata', () => {
    it('has correct id', () => {
      expect(provider.id).toBe('outlook_mail');
    });

    it('has correct displayName', () => {
      expect(provider.displayName).toBe('Outlook Mail');
    });

    it('has all 8 tools with correct names', () => {
      expect(provider.tools).toHaveLength(8);
      const names = provider.tools.map((t) => t.name);
      expect(names).toEqual([
        'outlook_mail_search',
        'outlook_mail_read_message',
        'outlook_mail_create_draft',
        'outlook_mail_list_drafts',
        'outlook_mail_send',
        'outlook_mail_reply',
        'outlook_mail_categorize',
        'outlook_mail_archive',
      ]);
    });

    it('has oauth config with Microsoft-specific settings', () => {
      expect(provider.oauth).toBeDefined();
      expect(provider.oauth.authorizeUrl).toContain('login.microsoftonline.com');
      expect(provider.oauth.tokenUrl).toContain('login.microsoftonline.com');
      expect(provider.oauth.scopes).toContain('offline_access');
      expect(provider.oauth.scopes).toContain('Mail.ReadWrite');
      expect(provider.oauth.scopes).toContain('Mail.Send');
      expect(provider.oauth.builtinClientId).toBeDefined();
      expect(provider.oauth.builtinClientSecret).toBeUndefined();
      expect(provider.oauth.pkce).toBe(true);
      expect(provider.oauth.settingsKeyPrefix).toBe('microsoft');
    });
  });

  describe('outlook_mail_search', () => {
    it('returns parsed message summaries', async () => {
      mockFetch({
        value: [{
          id: 'msg1',
          conversationId: 'conv1',
          from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
          subject: 'Hello',
          receivedDateTime: '2026-02-24T10:00:00Z',
          bodyPreview: 'Hello there',
          categories: ['Blue Category'],
          hasAttachments: false,
        }],
      });

      const result = await provider.execute('outlook_mail_search', {}, creds) as any;
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        id: 'msg1',
        threadId: 'conv1',
        from: 'Alice <alice@example.com>',
        subject: 'Hello',
        date: '2026-02-24T10:00:00Z',
        snippet: 'Hello there',
        labelIds: ['Blue Category'],
      });
      expect(result.resultSizeEstimate).toBe(1);
    });

    it('passes $search parameter with KQL query', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_search', { search: 'from:alice@example.com' }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('%24search=');
      expect(url).toContain('from%3Aalice%40example.com');
      // $orderby should not be present with $search
      expect(url).not.toContain('%24orderby');
    });

    it('applies $orderby when no search query', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_search', {}, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('%24orderby=receivedDateTime+desc');
      expect(url).not.toContain('%24search');
    });

    it('applies $filter parameter', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_search', { filter: 'isRead eq false' }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('%24filter=isRead+eq+false');
    });

    it('scopes to folder when folderId is provided', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_search', { folderId: 'Inbox' }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/me/mailFolders/Inbox/messages');
    });

    it('caps maxResults at 50', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_search', { maxResults: 100 }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('%24top=50');
    });

    it('defaults maxResults to 10', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_search', {}, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('%24top=10');
    });

    it('handles empty result set', async () => {
      mockFetch({ value: [] });

      const result = await provider.execute('outlook_mail_search', {}, creds) as any;
      expect(result.messages).toEqual([]);
      expect(result.resultSizeEstimate).toBe(0);
    });

    it('handles missing value in response', async () => {
      mockFetch({});

      const result = await provider.execute('outlook_mail_search', {}, creds) as any;
      expect(result.messages).toEqual([]);
      expect(result.resultSizeEstimate).toBe(0);
    });

    it('applies content filter guards to search results', async () => {
      mockFetch({
        value: [{
          id: 'msg1',
          conversationId: 'conv1',
          from: { emailAddress: { address: 'noreply@accountprotection.microsoft.com' } },
          subject: 'Your verification code',
          receivedDateTime: '2026-02-24T10:00:00Z',
          bodyPreview: 'Code: 123456',
          categories: [],
        }],
      });

      const result = await provider.execute(
        'outlook_mail_search',
        {},
        creds,
        { block_subjects: ['verification code'] },
      ) as any;

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].subject).toBe('[filtered]');
      expect(result.messages[0].from).toBe('[filtered]');
      expect(result.messages[0].snippet).toBe('[content hidden]');
    });

    it('applies sender domain blocking in search', async () => {
      mockFetch({
        value: [{
          id: 'msg1',
          conversationId: 'conv1',
          from: { emailAddress: { address: 'noreply@accountprotection.microsoft.com' } },
          subject: 'Sign-in activity',
          receivedDateTime: '2026-02-24T10:00:00Z',
          bodyPreview: 'New sign-in',
          categories: [],
        }],
      });

      const result = await provider.execute(
        'outlook_mail_search',
        {},
        creds,
        { block_sender_domains: ['accountprotection.microsoft.com'] },
      ) as any;

      expect(result.messages[0].subject).toBe('[filtered]');
    });

    it('applies PII redaction to search snippets', async () => {
      mockFetch({
        value: [{
          id: 'msg1',
          conversationId: 'conv1',
          from: { emailAddress: { address: 'hr@company.com' } },
          subject: 'Your info',
          receivedDateTime: '2026-02-24T10:00:00Z',
          bodyPreview: 'SSN: 123-45-6789',
          categories: [],
        }],
      });

      const result = await provider.execute(
        'outlook_mail_search',
        {},
        creds,
        { redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }] },
      ) as any;

      expect(result.messages[0].snippet).toBe('SSN: [REDACTED-SSN]');
    });

    it('escapes double quotes in KQL search', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_search', { search: 'subject:"meeting notes"' }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const decoded = decodeURIComponent(url);
      // The inner quotes in the KQL query should be escaped
      expect(decoded).toContain('$search=');
      expect(decoded).toContain('subject:\\"meeting');
      expect(decoded).toContain('notes\\"');
    });

    it('rejects filter with dangerous OData operators', async () => {
      await expect(
        provider.execute('outlook_mail_search', { filter: '$expand=attachments' }, creds),
      ).rejects.toThrow('Invalid filter');
    });

    it('formats from when only address is present (no name)', async () => {
      mockFetch({
        value: [{
          id: 'msg1',
          conversationId: 'conv1',
          from: { emailAddress: { address: 'alice@example.com' } },
          subject: 'Test',
          receivedDateTime: '2026-02-24T10:00:00Z',
          bodyPreview: '',
          categories: [],
        }],
      });

      const result = await provider.execute('outlook_mail_search', {}, creds) as any;
      expect(result.messages[0].from).toBe('alice@example.com');
    });
  });

  describe('outlook_mail_read_message', () => {
    it('returns parsed message with plaintext body', async () => {
      mockFetch({
        id: 'msg1',
        conversationId: 'conv1',
        categories: ['Blue Category'],
        from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
        toRecipients: [{ emailAddress: { name: 'Bob', address: 'bob@example.com' } }],
        ccRecipients: [],
        subject: 'Test Subject',
        receivedDateTime: '2026-02-24T10:00:00Z',
        body: { contentType: 'text', content: 'Hello, this is the message body.' },
        bodyPreview: 'Hello, this is the message',
        hasAttachments: false,
      });

      const result = await provider.execute('outlook_mail_read_message', { messageId: 'msg1' }, creds) as any;
      expect(result.id).toBe('msg1');
      expect(result.threadId).toBe('conv1');
      expect(result.from).toBe('Alice <alice@example.com>');
      expect(result.to).toBe('Bob <bob@example.com>');
      expect(result.subject).toBe('Test Subject');
      expect(result.body).toBe('Hello, this is the message body.');
      expect(result.hasAttachments).toBe(false);
      expect(result.labelIds).toEqual(['Blue Category']);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/messages/msg1');
    });

    it('strips HTML body to plaintext', async () => {
      mockFetch({
        id: 'msg2',
        conversationId: 'conv2',
        from: { emailAddress: { address: 'alice@example.com' } },
        toRecipients: [],
        subject: 'HTML message',
        receivedDateTime: '2026-02-24T10:00:00Z',
        body: { contentType: 'html', content: '<div>Hello <b>world</b></div>' },
        bodyPreview: 'Hello world',
        hasAttachments: false,
      });

      const result = await provider.execute('outlook_mail_read_message', { messageId: 'msg2' }, creds) as any;
      expect(result.body).toBe('Hello world');
    });

    it('falls back to bodyPreview when body content is empty', async () => {
      mockFetch({
        id: 'msg3',
        conversationId: 'conv3',
        from: { emailAddress: { address: 'alice@example.com' } },
        toRecipients: [],
        subject: 'Empty body',
        receivedDateTime: '2026-02-24T10:00:00Z',
        body: { contentType: 'text', content: '' },
        bodyPreview: 'Preview text here',
        hasAttachments: false,
      });

      const result = await provider.execute('outlook_mail_read_message', { messageId: 'msg3' }, creds) as any;
      expect(result.body).toBe('Preview text here');
    });

    it('blocks message when subject matches guard', async () => {
      mockFetch({
        id: 'msg4',
        conversationId: 'conv4',
        from: { emailAddress: { address: 'noreply@microsoft.com' } },
        toRecipients: [],
        subject: 'Your verification code is 123456',
        receivedDateTime: '2026-02-24T10:00:00Z',
        body: { contentType: 'text', content: 'Code: 123456' },
        bodyPreview: 'Code: 123456',
        hasAttachments: false,
      });

      const result = await provider.execute(
        'outlook_mail_read_message',
        { messageId: 'msg4' },
        creds,
        { block_subjects: ['verification code'] },
      ) as any;

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('verification code');
      expect(result.from).toBe('[blocked]');
      expect(result.subject).toBe('[blocked]');
    });

    it('blocks message when sender domain matches guard', async () => {
      mockFetch({
        id: 'msg5',
        conversationId: 'conv5',
        from: { emailAddress: { address: 'noreply@accountprotection.microsoft.com' } },
        toRecipients: [],
        subject: 'Security alert',
        receivedDateTime: '2026-02-24T10:00:00Z',
        body: { contentType: 'text', content: 'New sign-in detected' },
        bodyPreview: 'New sign-in detected',
        hasAttachments: false,
      });

      const result = await provider.execute(
        'outlook_mail_read_message',
        { messageId: 'msg5' },
        creds,
        { block_sender_domains: ['accountprotection.microsoft.com'] },
      ) as any;

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('accountprotection.microsoft.com');
    });

    it('redacts PII patterns in message body', async () => {
      mockFetch({
        id: 'msg6',
        conversationId: 'conv6',
        from: { emailAddress: { address: 'hr@company.com' } },
        toRecipients: [],
        subject: 'Your info',
        receivedDateTime: '2026-02-24T10:00:00Z',
        body: { contentType: 'text', content: 'SSN: 123-45-6789' },
        bodyPreview: 'SSN: 123-45-6789',
        hasAttachments: false,
      });

      const result = await provider.execute(
        'outlook_mail_read_message',
        { messageId: 'msg6' },
        creds,
        { redact_patterns: [{ pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' }] },
      ) as any;

      expect(result.body).toBe('SSN: [REDACTED-SSN]');
      expect(result.snippet).toBe('SSN: [REDACTED-SSN]');
    });

    it('returns unfiltered message when no guards', async () => {
      mockFetch({
        id: 'msg7',
        conversationId: 'conv7',
        from: { emailAddress: { address: 'noreply@accounts.google.com' } },
        toRecipients: [],
        subject: 'Your verification code',
        receivedDateTime: '2026-02-24T10:00:00Z',
        body: { contentType: 'text', content: 'Code: 999999' },
        bodyPreview: 'Code: 999999',
        hasAttachments: false,
      });

      const result = await provider.execute(
        'outlook_mail_read_message',
        { messageId: 'msg7' },
        creds,
      ) as any;

      // No guards — sensitive content passes through
      expect(result.body).toBe('Code: 999999');
      expect(result.subject).toBe('Your verification code');
    });
  });

  describe('outlook_mail_create_draft', () => {
    it('creates draft via POST to Graph API', async () => {
      mockFetch({ id: 'draft1', conversationId: 'conv1' });

      const result = await provider.execute('outlook_mail_create_draft', {
        to: 'alice@example.com',
        subject: 'Meeting notes',
        body: 'Here are the notes.',
      }, creds) as any;

      expect(result.draftId).toBe('draft1');
      expect(result.messageId).toBe('draft1');
      expect(result.threadId).toBe('conv1');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://graph.microsoft.com/v1.0/me/messages');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.subject).toBe('Meeting notes');
      expect(body.body).toEqual({ contentType: 'text', content: 'Here are the notes.' });
      expect(body.toRecipients).toEqual([{ emailAddress: { address: 'alice@example.com' } }]);
    });

    it('includes CC and BCC when provided', async () => {
      mockFetch({ id: 'draft2' });

      await provider.execute('outlook_mail_create_draft', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        cc: 'charlie@example.com',
        bcc: 'secret@example.com',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.ccRecipients).toEqual([{ emailAddress: { address: 'charlie@example.com' } }]);
      expect(body.bccRecipients).toEqual([{ emailAddress: { address: 'secret@example.com' } }]);
    });

    it('includes conversationId for threading', async () => {
      mockFetch({ id: 'draft3', conversationId: 'conv1' });

      await provider.execute('outlook_mail_create_draft', {
        to: 'alice@example.com',
        subject: 'Re: Test',
        body: 'Reply body',
        conversationId: 'conv1',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.conversationId).toBe('conv1');
    });

    it('parses comma-separated recipients', async () => {
      mockFetch({ id: 'draft4' });

      await provider.execute('outlook_mail_create_draft', {
        to: 'alice@example.com, bob@example.com, charlie@example.com',
        subject: 'Test',
        body: 'Body',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.toRecipients).toHaveLength(3);
      expect(body.toRecipients[0].emailAddress.address).toBe('alice@example.com');
      expect(body.toRecipients[1].emailAddress.address).toBe('bob@example.com');
      expect(body.toRecipients[2].emailAddress.address).toBe('charlie@example.com');
    });

    it('strips CRLF from headers to prevent injection', async () => {
      mockFetch({ id: 'draft5' });

      await provider.execute('outlook_mail_create_draft', {
        to: 'victim@example.com\r\nBcc: evil@attacker.com',
        subject: 'Normal\r\nBcc: evil@attacker.com',
        body: 'Body',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.subject).toBe('NormalBcc: evil@attacker.com');
      expect(body.toRecipients[0].emailAddress.address).toBe('victim@example.comBcc: evil@attacker.com');
    });
  });

  describe('outlook_mail_list_drafts', () => {
    it('returns draft summaries', async () => {
      mockFetch({
        value: [{
          id: 'draft1',
          conversationId: 'conv1',
          toRecipients: [{ emailAddress: { address: 'alice@example.com' } }],
          subject: 'Draft subject',
          bodyPreview: 'Draft content preview',
          receivedDateTime: '2026-02-24T10:00:00Z',
        }],
      });

      const result = await provider.execute('outlook_mail_list_drafts', {}, creds) as any;
      expect(result.drafts).toHaveLength(1);
      expect(result.drafts[0]).toEqual({
        draftId: 'draft1',
        messageId: 'draft1',
        to: 'alice@example.com',
        subject: 'Draft subject',
        snippet: 'Draft content preview',
      });
    });

    it('caps maxResults at 50', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_list_drafts', { maxResults: 100 }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('%24top=50');
    });

    it('defaults maxResults to 10', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_list_drafts', {}, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('%24top=10');
    });

    it('handles empty draft list', async () => {
      mockFetch({ value: [] });

      const result = await provider.execute('outlook_mail_list_drafts', {}, creds) as any;
      expect(result.drafts).toEqual([]);
    });

    it('joins multiple recipients with commas', async () => {
      mockFetch({
        value: [{
          id: 'draft2',
          toRecipients: [
            { emailAddress: { address: 'alice@example.com' } },
            { emailAddress: { address: 'bob@example.com' } },
          ],
          subject: 'Group draft',
          bodyPreview: 'Hello all',
        }],
      });

      const result = await provider.execute('outlook_mail_list_drafts', {}, creds) as any;
      expect(result.drafts[0].to).toBe('alice@example.com, bob@example.com');
    });

    it('queries the Drafts folder', async () => {
      mockFetch({ value: [] });

      await provider.execute('outlook_mail_list_drafts', {}, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/me/mailFolders/Drafts/messages');
    });
  });

  describe('outlook_mail_send', () => {
    it('sends email via sendMail endpoint', async () => {
      mockFetch202();

      const result = await provider.execute('outlook_mail_send', {
        to: 'alice@example.com',
        subject: 'Hello',
        body: 'Hi Alice',
      }, creds) as any;

      expect(result.sent).toBe(true);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://graph.microsoft.com/v1.0/me/sendMail');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.saveToSentItems).toBe(true);
      expect(body.message.subject).toBe('Hello');
      expect(body.message.toRecipients).toEqual([{ emailAddress: { address: 'alice@example.com' } }]);
    });

    it('includes CC and BCC', async () => {
      mockFetch202();

      await provider.execute('outlook_mail_send', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        cc: 'charlie@example.com',
        bcc: 'secret@example.com',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message.ccRecipients).toEqual([{ emailAddress: { address: 'charlie@example.com' } }]);
      expect(body.message.bccRecipients).toEqual([{ emailAddress: { address: 'secret@example.com' } }]);
    });

    it('uses explicit from address', async () => {
      mockFetch202();

      await provider.execute('outlook_mail_send', {
        to: 'alice@example.com',
        subject: 'Test',
        body: 'Body',
        from: 'myalias@example.com',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message.from).toEqual({ emailAddress: { address: 'myalias@example.com' } });
    });

    it('applies alias suffix from connectionSettings', async () => {
      mockFetch202();

      await provider.execute(
        'outlook_mail_send',
        { to: 'bob@example.com', subject: 'Test', body: 'Body' },
        { ...creds, account_email: 'user@example.com' },
        undefined,
        { emailAliasSuffix: '+agent' },
      );

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message.from).toEqual({ emailAddress: { address: 'user+agent@example.com' } });
    });

    it('sends without from when no alias and no explicit from', async () => {
      mockFetch202();

      await provider.execute('outlook_mail_send', {
        to: 'bob@example.com',
        subject: 'Test',
        body: 'Body',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message.from).toBeUndefined();
    });

    it('explicit from takes precedence over alias suffix', async () => {
      mockFetch202();

      await provider.execute(
        'outlook_mail_send',
        { to: 'bob@example.com', subject: 'Test', body: 'Body', from: 'explicit@example.com' },
        { ...creds, account_email: 'user@example.com' },
        undefined,
        { emailAliasSuffix: '+agent' },
      );

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message.from).toEqual({ emailAddress: { address: 'explicit@example.com' } });
    });

    it('strips CRLF from all header fields', async () => {
      mockFetch202();

      await provider.execute('outlook_mail_send', {
        to: 'victim@example.com\r\nBcc: evil@attacker.com',
        subject: 'Normal\nSubject',
        body: 'Body',
        from: 'sender@example.com\r\nBcc: evil@attacker.com',
      }, creds);

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message.toRecipients[0].emailAddress.address).not.toContain('\r');
      expect(body.message.toRecipients[0].emailAddress.address).not.toContain('\n');
      expect(body.message.subject).not.toContain('\r');
      expect(body.message.subject).not.toContain('\n');
      expect(body.message.from.emailAddress.address).not.toContain('\r');
      expect(body.message.from.emailAddress.address).not.toContain('\n');
    });
  });

  describe('outlook_mail_reply', () => {
    it('replies to a single recipient via Graph reply endpoint', async () => {
      mockFetch202();

      const result = await provider.execute('outlook_mail_reply', {
        messageId: 'msg1',
        body: 'Thanks!',
      }, creds) as any;

      expect(result.replied).toBe(true);
      expect(result.replyAll).toBe(false);
      expect(result.messageId).toBe('msg1');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://graph.microsoft.com/v1.0/me/messages/msg1/reply');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.comment).toBe('Thanks!');
    });

    it('uses replyAll endpoint when replyAll=true', async () => {
      mockFetch202();

      const result = await provider.execute('outlook_mail_reply', {
        messageId: 'msg1',
        body: 'Reply to all',
        replyAll: true,
      }, creds) as any;

      expect(result.replyAll).toBe(true);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/me/messages/msg1/replyAll');
    });

    it('defaults replyAll to false', async () => {
      mockFetch202();

      await provider.execute('outlook_mail_reply', {
        messageId: 'msg1',
        body: 'Reply',
      }, creds);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/me/messages/msg1/reply');
      expect(url).not.toContain('replyAll');
    });
  });

  describe('outlook_mail_categorize', () => {
    it('adds new categories', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // GET current categories
          return {
            ok: true, status: 200,
            json: async () => ({ categories: ['Blue Category'] }),
            text: async () => '{}',
          };
        }
        // PATCH with merged categories
        return {
          ok: true, status: 200,
          json: async () => ({}),
          text: async () => '{}',
        };
      });

      const result = await provider.execute('outlook_mail_categorize', {
        messageId: 'msg1',
        addCategories: ['Red Category'],
      }, creds) as any;

      expect(result.categories).toEqual(['Blue Category', 'Red Category']);
      expect(callCount).toBe(2);

      // Verify PATCH body
      const patchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(patchCall[1].method).toBe('PATCH');
      const body = JSON.parse(patchCall[1].body);
      expect(body.categories).toEqual(['Blue Category', 'Red Category']);
    });

    it('removes categories', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true, status: 200,
            json: async () => ({ categories: ['Blue Category', 'Red Category'] }),
            text: async () => '{}',
          };
        }
        return {
          ok: true, status: 200,
          json: async () => ({}),
          text: async () => '{}',
        };
      });

      const result = await provider.execute('outlook_mail_categorize', {
        messageId: 'msg1',
        removeCategories: ['Blue Category'],
      }, creds) as any;

      expect(result.categories).toEqual(['Red Category']);
    });

    it('handles case-insensitive category deduplication', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true, status: 200,
            json: async () => ({ categories: ['Blue Category'] }),
            text: async () => '{}',
          };
        }
        return {
          ok: true, status: 200,
          json: async () => ({}),
          text: async () => '{}',
        };
      });

      const result = await provider.execute('outlook_mail_categorize', {
        messageId: 'msg1',
        addCategories: ['blue category'], // same category, different case
      }, creds) as any;

      // Should not duplicate
      expect(result.categories).toEqual(['Blue Category']);
    });

    it('returns early when no categories to add or remove', async () => {
      mockFetch({}); // set up spy so we can verify it was not called
      const result = await provider.execute('outlook_mail_categorize', {
        messageId: 'msg1',
      }, creds) as any;

      expect(result.modified).toBe(false);
      expect(result.reason).toBe('No categories to add or remove');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('handles add and remove in same operation', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true, status: 200,
            json: async () => ({ categories: ['Blue Category', 'Green Category'] }),
            text: async () => '{}',
          };
        }
        return {
          ok: true, status: 200,
          json: async () => ({}),
          text: async () => '{}',
        };
      });

      const result = await provider.execute('outlook_mail_categorize', {
        messageId: 'msg1',
        addCategories: ['Red Category'],
        removeCategories: ['Green Category'],
      }, creds) as any;

      expect(result.categories).toEqual(['Blue Category', 'Red Category']);
    });

    it('handles empty existing categories', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true, status: 200,
            json: async () => ({ categories: undefined }),
            text: async () => '{}',
          };
        }
        return {
          ok: true, status: 200,
          json: async () => ({}),
          text: async () => '{}',
        };
      });

      const result = await provider.execute('outlook_mail_categorize', {
        messageId: 'msg1',
        addCategories: ['Red Category'],
      }, creds) as any;

      expect(result.categories).toEqual(['Red Category']);
    });
  });

  describe('outlook_mail_archive', () => {
    it('moves message to archive folder', async () => {
      mockFetch({});

      const result = await provider.execute('outlook_mail_archive', {
        messageId: 'msg1',
      }, creds) as any;

      expect(result.messageId).toBe('msg1');
      expect(result.archived).toBe(true);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://graph.microsoft.com/v1.0/me/messages/msg1/move');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.destinationId).toBe('archive');
    });
  });

  describe('refreshCredentials', () => {
    it('refreshes tokens via Microsoft token endpoint', async () => {
      mockFetch({
        access_token: 'new_tok',
        refresh_token: 'new_ref',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      const result = await provider.refreshCredentials(
        { ...creds, account_email: 'user@example.com' },
        { clientId: 'cid', clientSecret: 'csec' },
      );

      expect(result.access_token).toBe('new_tok');
      expect(result.refresh_token).toBe('new_ref');
      expect(typeof result.expiry_date).toBe('number');
      expect(result.token_type).toBe('Bearer');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('login.microsoftonline.com');
      expect(fetchCall[1].method).toBe('POST');
    });

    it('preserves account_email through refresh', async () => {
      mockFetch({
        access_token: 'new_tok',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      const result = await provider.refreshCredentials(
        { ...creds, account_email: 'user@example.com' },
        { clientId: 'cid' },
      );

      expect(result.account_email).toBe('user@example.com');
    });

    it('preserves old refresh_token if new one not provided', async () => {
      mockFetch({
        access_token: 'new_tok',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      const result = await provider.refreshCredentials(creds, { clientId: 'cid' });
      expect(result.refresh_token).toBe('ref');
    });
  });

  describe('error handling', () => {
    it('throws on unknown tool', async () => {
      await expect(
        provider.execute('outlook_mail_delete', {}, creds),
      ).rejects.toThrow('Unknown tool: outlook_mail_delete');
    });

    it('throws on Graph API error', async () => {
      mockFetch({ error: { message: 'Forbidden' } }, 403);

      await expect(
        provider.execute('outlook_mail_search', {}, creds),
      ).rejects.toThrow('Microsoft Graph API error (403)');
    });
  });

  describe('path traversal prevention', () => {
    it('rejects messageId with path separators in read_message', async () => {
      await expect(
        provider.execute('outlook_mail_read_message', { messageId: '../../../me/calendars' }, creds),
      ).rejects.toThrow('Invalid messageId');
    });

    it('rejects messageId with backslashes in archive', async () => {
      await expect(
        provider.execute('outlook_mail_archive', { messageId: '..\\admin' }, creds),
      ).rejects.toThrow('Invalid messageId');
    });

    it('rejects messageId with dot-dot in categorize', async () => {
      globalThis.fetch = vi.fn(); // prevent actual fetch
      await expect(
        provider.execute('outlook_mail_categorize', {
          messageId: '..',
          addCategories: ['test'],
        }, creds),
      ).rejects.toThrow('Invalid messageId');
    });

    it('rejects messageId with query string characters in reply', async () => {
      await expect(
        provider.execute('outlook_mail_reply', { messageId: 'msg?$expand=all', body: 'test' }, creds),
      ).rejects.toThrow('Invalid messageId');
    });

    it('rejects folderId with path separators in search', async () => {
      await expect(
        provider.execute('outlook_mail_search', { folderId: '../../admin' }, creds),
      ).rejects.toThrow('Invalid folderId');
    });
  });

  describe('oauth discoverAccount', () => {
    it('returns email from Microsoft Graph /me endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mail: 'user@outlook.com', userPrincipalName: 'user@outlook.com' }),
      });

      const account = await provider.oauth.discoverAccount('test-token');
      expect(account).toBe('user@outlook.com');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('graph.microsoft.com/v1.0/me');
      expect(fetchCall[1].headers.Authorization).toBe('Bearer test-token');
    });

    it('falls back to userPrincipalName when mail is absent', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ userPrincipalName: 'user@contoso.onmicrosoft.com' }),
      });

      const account = await provider.oauth.discoverAccount('test-token');
      expect(account).toBe('user@contoso.onmicrosoft.com');
    });

    it('returns unknown on API error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const account = await provider.oauth.discoverAccount('bad-token');
      expect(account).toBe('unknown');
    });
  });
});
