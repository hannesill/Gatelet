import { google } from 'googleapis';
import type { Provider, OAuthConfig } from '../types.js';
import { gmailTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';
import { presets as gmailPresets } from './presets.js';
import { parseMessage } from './message-parser.js';
import { applyContentFilters, filterSearchResult } from '../email/content-filter.js';
import { sanitizeHeader } from '../email/sanitize.js';
import { buildGoogleAuth, refreshGoogleTokens, buildGoogleOAuthConfig } from '../google/google.js';
import { GateletError } from '../gatelet-error.js';

export class GmailProvider implements Provider {
  id = 'google_gmail';
  displayName = 'Gmail';
  tools = gmailTools;
  defaultPolicyYaml = defaultPolicyYaml;
  presets = gmailPresets;

  oauth: OAuthConfig = buildGoogleOAuthConfig(
    [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    async (accessToken: string): Promise<string> => {
      const res = await fetch(
        'https://www.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return 'unknown';
      const data = (await res.json()) as { emailAddress?: string };
      return data.emailAddress ?? 'unknown';
    },
  );

  private buildClient(credentials: Record<string, unknown>) {
    const auth = buildGoogleAuth(credentials);
    return google.gmail({ version: 'v1', auth });
  }

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
    connectionSettings?: Record<string, unknown>,
  ): Promise<unknown> {
    const gmail = this.buildClient(credentials);

    switch (toolName) {
      case 'gmail_search': {
        const q = (params.q as string | undefined) ?? '';
        const maxResults = Math.min((params.maxResults as number) ?? 10, 50);

        const res = await gmail.users.messages.list({
          userId: 'me',
          q: q || undefined,
          maxResults,
        });

        const messages = res.data.messages ?? [];
        if (messages.length === 0) {
          return { messages: [], resultSizeEstimate: 0 };
        }

        const summaries = await Promise.all(
          messages.map(async (m) => {
            const msg = await gmail.users.messages.get({
              userId: 'me',
              id: m.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date'],
            });
            const headers = msg.data.payload?.headers ?? [];
            const getHeader = (name: string) =>
              headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
            return {
              id: m.id,
              threadId: m.threadId,
              from: getHeader('From'),
              subject: getHeader('Subject'),
              date: getHeader('Date'),
              snippet: msg.data.snippet ?? '',
              labelIds: msg.data.labelIds ?? [],
            };
          }),
        );

        if (guards) {
          const filtered = summaries.map((s) => filterSearchResult(s, guards));
          return { messages: filtered, resultSizeEstimate: res.data.resultSizeEstimate };
        }

        return { messages: summaries, resultSizeEstimate: res.data.resultSizeEstimate };
      }

      case 'gmail_read_message': {
        const messageId = params.messageId as string;

        const res = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const parsed = parseMessage(res.data as Record<string, unknown>);

        if (guards) {
          const filterResult = applyContentFilters(parsed, guards);
          if (filterResult.blocked) {
            return filterResult;
          }
          return filterResult.message;
        }

        return parsed;
      }

      case 'gmail_create_draft': {
        const to = sanitizeHeader(params.to as string);
        const subject = sanitizeHeader(params.subject as string);
        const body = params.body as string;
        const cc = params.cc ? sanitizeHeader(params.cc as string) : undefined;
        const bcc = params.bcc ? sanitizeHeader(params.bcc as string) : undefined;
        const inReplyTo = params.inReplyTo as string | undefined;
        const threadId = params.threadId as string | undefined;

        const headers: string[] = [
          `To: ${to}`,
          `Subject: ${subject}`,
          'Content-Type: text/plain; charset="UTF-8"',
        ];
        if (cc) headers.splice(1, 0, `Cc: ${cc}`);
        if (bcc) headers.splice(cc ? 2 : 1, 0, `Bcc: ${bcc}`);
        if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);

        const rawMessage = Buffer.from(
          headers.join('\r\n') + '\r\n\r\n' + body,
        ).toString('base64url');

        const res = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: { raw: rawMessage, threadId: threadId ?? undefined },
          },
        });

        return {
          draftId: res.data.id,
          messageId: res.data.message?.id,
          threadId: res.data.message?.threadId,
        };
      }

      case 'gmail_send': {
        const to = sanitizeHeader(params.to as string);
        const subject = sanitizeHeader(params.subject as string);
        const body = params.body as string;
        const cc = params.cc ? sanitizeHeader(params.cc as string) : undefined;
        const bcc = params.bcc ? sanitizeHeader(params.bcc as string) : undefined;

        // Determine From address: explicit param > alias suffix > omit (use account default)
        let from = params.from ? sanitizeHeader(params.from as string) : undefined;
        if (!from && connectionSettings?.emailAliasSuffix) {
          // account_email should be stored in credentials during OAuth
          const accountEmail = credentials.account_email as string | undefined;
          if (accountEmail) {
            const [local, domain] = accountEmail.split('@');
            from = `${local}${connectionSettings.emailAliasSuffix}@${domain}`;
          }
        }

        const headers: string[] = [];
        if (from) headers.push(`From: ${from}`);
        headers.push(`To: ${to}`);
        if (cc) headers.push(`Cc: ${cc}`);
        if (bcc) headers.push(`Bcc: ${bcc}`);
        headers.push(`Subject: ${subject}`);
        headers.push('Content-Type: text/plain; charset="UTF-8"');

        const rawMessage = Buffer.from(
          headers.join('\r\n') + '\r\n\r\n' + body,
        ).toString('base64url');

        const res = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage },
        });

        return {
          messageId: res.data.id,
          threadId: res.data.threadId,
        };
      }

      case 'gmail_reply': {
        const messageId = params.messageId as string;
        const body = params.body as string;
        const replyAll = (params.replyAll as boolean) ?? false;

        // Fetch original message for threading headers
        const original = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Message-ID', 'References'],
        });

        const origHeaders = original.data.payload?.headers ?? [];
        const getHeader = (name: string) =>
          origHeaders.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

        const origFrom = getHeader('From');
        const origTo = getHeader('To');
        const origCc = getHeader('Cc');
        const origSubject = getHeader('Subject');
        const origMessageId = getHeader('Message-ID');
        const origReferences = getHeader('References');

        // Determine recipient(s): reply goes to sender; reply-all goes to sender + original To/Cc
        const to = sanitizeHeader(origFrom);
        const replySubject = sanitizeHeader(
          origSubject.startsWith('Re:') ? origSubject : `Re: ${origSubject}`,
        );

        const headers: string[] = [
          `To: ${to}`,
          `Subject: ${replySubject}`,
          'Content-Type: text/plain; charset="UTF-8"',
        ];

        // Determine From address with alias
        let from: string | undefined;
        if (connectionSettings?.emailAliasSuffix) {
          const accountEmail = credentials.account_email as string | undefined;
          if (accountEmail) {
            const [local, domain] = accountEmail.split('@');
            from = `${local}${connectionSettings.emailAliasSuffix}@${domain}`;
          }
        }
        if (from) headers.unshift(`From: ${sanitizeHeader(from)}`);

        if (replyAll) {
          // Add original To and Cc as Cc on reply-all (sender is already in To)
          const ccParts: string[] = [];
          if (origTo) ccParts.push(origTo);
          if (origCc) ccParts.push(origCc);
          if (ccParts.length > 0) {
            headers.splice(
              headers.indexOf(`Subject: ${replySubject}`),
              0,
              `Cc: ${sanitizeHeader(ccParts.join(', '))}`,
            );
          }
        }

        if (origMessageId) {
          const safeMessageId = sanitizeHeader(origMessageId);
          headers.push(`In-Reply-To: ${safeMessageId}`);
          const references = origReferences
            ? `${sanitizeHeader(origReferences)} ${safeMessageId}`
            : safeMessageId;
          headers.push(`References: ${references}`);
        }

        const rawMessage = Buffer.from(
          headers.join('\r\n') + '\r\n\r\n' + body,
        ).toString('base64url');

        const res = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: rawMessage,
            threadId: original.data.threadId ?? undefined,
          },
        });

        return {
          messageId: res.data.id,
          threadId: res.data.threadId,
          inReplyTo: origMessageId,
        };
      }

      case 'gmail_label': {
        const messageId = params.messageId as string;
        const addLabelIds = params.addLabelIds as string[] | undefined;
        const removeLabelIds = params.removeLabelIds as string[] | undefined;

        if (!addLabelIds?.length && !removeLabelIds?.length) {
          return { messageId, modified: false, reason: 'No labels to add or remove' };
        }

        // Check protected labels
        const protectedLabels = (guards?.protected_labels as string[]) ?? ['TRASH', 'SPAM'];
        for (const labelId of addLabelIds ?? []) {
          if (protectedLabels.includes(labelId)) {
            throw new GateletError(`Cannot add protected label: ${labelId}`);
          }
        }
        for (const labelId of removeLabelIds ?? []) {
          if (protectedLabels.includes(labelId)) {
            throw new GateletError(`Cannot remove protected label: ${labelId}`);
          }
        }

        const res = await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds: addLabelIds ?? [],
            removeLabelIds: removeLabelIds ?? [],
          },
        });

        return {
          messageId: res.data.id,
          threadId: res.data.threadId,
        };
      }

      case 'gmail_archive': {
        const messageId = params.messageId as string;

        const res = await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            removeLabelIds: ['INBOX'],
          },
        });

        return {
          messageId: res.data.id,
          threadId: res.data.threadId,
          archived: true,
        };
      }

      case 'gmail_move': {
        const messageId = params.messageId as string;
        const labelId = params.labelId as string;

        // Check protected labels — agent cannot move messages to TRASH or SPAM
        const protectedLabels = (guards?.protected_labels as string[]) ?? ['TRASH', 'SPAM'];
        if (protectedLabels.includes(labelId)) {
          throw new GateletError(`Cannot move to protected label: ${labelId}`);
        }

        const res = await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds: [labelId],
            removeLabelIds: ['INBOX'],
          },
        });

        return {
          messageId: res.data.id,
          threadId: res.data.threadId,
          movedTo: labelId,
        };
      }

      case 'gmail_list_labels': {
        const res = await gmail.users.labels.list({ userId: 'me' });
        const labels = (res.data.labels ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
        }));
        return { labels };
      }

      case 'gmail_list_drafts': {
        const maxResults = Math.min((params.maxResults as number) ?? 10, 50);

        const res = await gmail.users.drafts.list({
          userId: 'me',
          maxResults,
        });

        const drafts = res.data.drafts ?? [];
        if (drafts.length === 0) {
          return { drafts: [] };
        }

        const summaries = await Promise.all(
          drafts.map(async (d) => {
            const draft = await gmail.users.drafts.get({
              userId: 'me',
              id: d.id!,
              format: 'metadata',
            });
            const headers = draft.data.message?.payload?.headers ?? [];
            const getHeader = (name: string) =>
              headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
            return {
              draftId: d.id,
              messageId: d.message?.id,
              to: getHeader('To'),
              subject: getHeader('Subject'),
              snippet: draft.data.message?.snippet ?? '',
            };
          }),
        );

        return { drafts: summaries };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async refreshCredentials(
    credentials: Record<string, unknown>,
    oauthClientInfo: { clientId: string; clientSecret: string },
  ): Promise<Record<string, unknown>> {
    return {
      ...await refreshGoogleTokens(credentials, oauthClientInfo),
      account_email: credentials.account_email,
    };
  }
}
