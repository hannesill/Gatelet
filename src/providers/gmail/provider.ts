import { google } from 'googleapis';
import type { Provider, OAuthConfig } from '../types.js';
import { gmailTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';
import { parseMessage } from './message-parser.js';
import { applyContentFilters } from '../email/content-filter.js';

export class GmailProvider implements Provider {
  id = 'google_gmail';
  displayName = 'Gmail';
  tools = gmailTools;
  defaultPolicyYaml = defaultPolicyYaml;

  oauth: OAuthConfig = {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    builtinClientId: '1096469986430-ap9lls3vhlu25v87ae3c8i8s3dhgaaiu.apps.googleusercontent.com',
    builtinClientSecret: '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',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
    settingsKeyPrefix: 'google',
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
    async discoverAccount(accessToken: string): Promise<string> {
      const res = await fetch(
        'https://www.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return 'unknown';
      const data = (await res.json()) as { emailAddress?: string };
      return data.emailAddress ?? 'unknown';
    },
  };

  private buildClient(credentials: Record<string, unknown>) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: credentials.access_token as string,
      refresh_token: credentials.refresh_token as string,
      expiry_date: credentials.expiry_date as number | undefined,
      token_type: credentials.token_type as string | undefined,
    });
    return google.gmail({ version: 'v1', auth });
  }

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
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
        const to = params.to as string;
        const subject = params.subject as string;
        const body = params.body as string;
        const cc = params.cc as string | undefined;
        const bcc = params.bcc as string | undefined;
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
    const auth = new google.auth.OAuth2(
      oauthClientInfo.clientId,
      oauthClientInfo.clientSecret,
    );
    auth.setCredentials({
      refresh_token: credentials.refresh_token as string,
    });
    const { credentials: newCreds } = await auth.refreshAccessToken();
    return {
      access_token: newCreds.access_token,
      refresh_token: newCreds.refresh_token ?? credentials.refresh_token,
      expiry_date: newCreds.expiry_date,
      token_type: newCreds.token_type,
    };
  }
}
