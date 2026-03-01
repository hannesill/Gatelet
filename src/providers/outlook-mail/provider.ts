import type { Provider, OAuthConfig } from '../types.js';
import { outlookMailTools } from './tools.js';
import { defaultPolicyYaml } from './default-policy.js';
import { presets as outlookMailPresets } from './presets.js';
import { parseGraphMessage } from './message-parser.js';
import { applyContentFilters, filterSearchResult } from '../email/content-filter.js';
import {
  graphFetch,
  validatePathSegment,
  validateODataFilter,
  refreshMicrosoftTokens,
  buildMicrosoftOAuthConfig,
} from '../microsoft/graph.js';
import { sanitizeHeader } from '../email/sanitize.js';
import { GateletError } from '../gatelet-error.js';

/** Parse comma-separated email addresses into Graph API recipient format */
function parseRecipients(addresses: string): Array<{ emailAddress: { address: string } }> {
  return addresses
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address: sanitizeHeader(address) } }));
}

export class OutlookMailProvider implements Provider {
  id = 'outlook_mail';
  displayName = 'Outlook Mail';
  tools = outlookMailTools;
  defaultPolicyYaml = defaultPolicyYaml;
  presets = outlookMailPresets;

  oauth: OAuthConfig = buildMicrosoftOAuthConfig(
    ['offline_access', 'User.Read', 'Mail.ReadWrite', 'Mail.Send'],
    {
      'read-only': ['offline_access', 'User.Read', 'Mail.Read'],
      'full-access': ['offline_access', 'User.Read', 'Mail.ReadWrite', 'Mail.Send'],
    },
  );

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    credentials: Record<string, unknown>,
    guards?: Record<string, unknown>,
    connectionSettings?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'outlook_mail_search': {
        const search = params.search as string | undefined;
        const filter = params.filter as string | undefined;
        const folderId = params.folderId as string | undefined;
        const maxResults = Math.min((params.maxResults as number) ?? 10, 50);

        // Build the base path
        let basePath: string;
        if (folderId) {
          validatePathSegment(folderId, 'folderId');
          basePath = `/me/mailFolders/${folderId}/messages`;
        } else {
          basePath = '/me/messages';
        }

        const qs = new URLSearchParams({
          $top: String(maxResults),
          $select: 'id,conversationId,from,subject,receivedDateTime,bodyPreview,categories,hasAttachments',
        });

        if (search) {
          // Sanitize KQL by escaping double quotes
          const safeSearch = search.replace(/"/g, '\\"');
          qs.set('$search', `"${safeSearch}"`);
          // Graph API does not allow $orderby with $search
        } else {
          qs.set('$orderby', 'receivedDateTime desc');
        }

        if (filter) {
          validateODataFilter(filter);
          qs.set('$filter', filter);
        }

        const data = await graphFetch(`${basePath}?${qs.toString()}`, credentials) as {
          value?: Array<Record<string, unknown>>;
        };

        const messages = data.value ?? [];
        const summaries = messages.map((m) => ({
          id: (m.id as string) ?? null,
          threadId: (m.conversationId as string) ?? null,
          from: m.from
            ? (() => {
                const ea = (m.from as { emailAddress?: { name?: string; address?: string } }).emailAddress;
                return ea?.name ? `${ea.name} <${ea.address}>` : ea?.address ?? '';
              })()
            : '',
          subject: (m.subject as string) ?? '',
          date: (m.receivedDateTime as string) ?? '',
          snippet: (m.bodyPreview as string) ?? '',
          labelIds: (m.categories as string[]) ?? [],
        }));

        if (guards) {
          const filtered = summaries.map((s) => filterSearchResult(s, guards));
          return { messages: filtered, resultSizeEstimate: summaries.length };
        }

        return { messages: summaries, resultSizeEstimate: summaries.length };
      }

      case 'outlook_mail_read_message': {
        const messageId = params.messageId as string;
        validatePathSegment(messageId, 'messageId');

        const data = await graphFetch(`/me/messages/${messageId}`, credentials) as Record<string, unknown>;
        const parsed = parseGraphMessage(data);

        if (guards) {
          const filterResult = applyContentFilters(parsed, guards);
          if (filterResult.blocked) {
            return filterResult;
          }
          return filterResult.message;
        }

        return parsed;
      }

      case 'outlook_mail_create_draft': {
        const to = sanitizeHeader(params.to as string);
        const subject = sanitizeHeader(params.subject as string);
        const body = params.body as string;
        const cc = params.cc ? sanitizeHeader(params.cc as string) : undefined;
        const bcc = params.bcc ? sanitizeHeader(params.bcc as string) : undefined;
        const conversationId = params.conversationId as string | undefined;

        const message: Record<string, unknown> = {
          subject,
          body: { contentType: 'text', content: body },
          toRecipients: parseRecipients(to),
        };
        if (cc) message.ccRecipients = parseRecipients(cc);
        if (bcc) message.bccRecipients = parseRecipients(bcc);
        if (conversationId) message.conversationId = conversationId;

        const data = await graphFetch('/me/messages', credentials, {
          method: 'POST',
          body: message,
        }) as { id?: string; conversationId?: string };

        return {
          draftId: data.id,
          messageId: data.id,
          threadId: data.conversationId,
        };
      }

      case 'outlook_mail_list_drafts': {
        const maxResults = Math.min((params.maxResults as number) ?? 10, 50);

        const qs = new URLSearchParams({
          $top: String(maxResults),
          $select: 'id,conversationId,toRecipients,subject,bodyPreview,receivedDateTime',
          $orderby: 'receivedDateTime desc',
        });

        const data = await graphFetch(
          `/me/mailFolders/Drafts/messages?${qs.toString()}`,
          credentials,
        ) as { value?: Array<Record<string, unknown>> };

        const drafts = (data.value ?? []).map((d) => ({
          draftId: d.id as string,
          messageId: d.id as string,
          to: Array.isArray(d.toRecipients)
            ? (d.toRecipients as Array<{ emailAddress?: { address?: string } }>)
                .map((r) => r.emailAddress?.address ?? '')
                .filter(Boolean)
                .join(', ')
            : '',
          subject: (d.subject as string) ?? '',
          snippet: (d.bodyPreview as string) ?? '',
        }));

        return { drafts };
      }

      case 'outlook_mail_send': {
        const to = sanitizeHeader(params.to as string);
        const subject = sanitizeHeader(params.subject as string);
        const body = params.body as string;
        const cc = params.cc ? sanitizeHeader(params.cc as string) : undefined;
        const bcc = params.bcc ? sanitizeHeader(params.bcc as string) : undefined;

        // Determine From address: explicit param > alias suffix > omit (use account default)
        let from = params.from ? sanitizeHeader(params.from as string) : undefined;
        if (!from && connectionSettings?.emailAliasSuffix) {
          const accountEmail = credentials.account_email as string | undefined;
          if (accountEmail) {
            const [local, domain] = accountEmail.split('@');
            from = `${local}${connectionSettings.emailAliasSuffix}@${domain}`;
          }
        }

        const message: Record<string, unknown> = {
          subject,
          body: { contentType: 'text', content: body },
          toRecipients: parseRecipients(to),
        };
        if (cc) message.ccRecipients = parseRecipients(cc);
        if (bcc) message.bccRecipients = parseRecipients(bcc);
        if (from) message.from = { emailAddress: { address: from } };

        await graphFetch('/me/sendMail', credentials, {
          method: 'POST',
          body: { message, saveToSentItems: true },
        });

        return { sent: true };
      }

      case 'outlook_mail_reply': {
        const messageId = params.messageId as string;
        const body = params.body as string;
        const replyAll = (params.replyAll as boolean) ?? false;

        validatePathSegment(messageId, 'messageId');

        const endpoint = replyAll
          ? `/me/messages/${messageId}/replyAll`
          : `/me/messages/${messageId}/reply`;

        await graphFetch(endpoint, credentials, {
          method: 'POST',
          body: { comment: body },
        });

        return { replied: true, replyAll, messageId };
      }

      case 'outlook_mail_categorize': {
        const messageId = params.messageId as string;
        const addCategories = params.addCategories as string[] | undefined;
        const removeCategories = params.removeCategories as string[] | undefined;

        if (!addCategories?.length && !removeCategories?.length) {
          return { messageId, modified: false, reason: 'No categories to add or remove' };
        }

        validatePathSegment(messageId, 'messageId');

        // Fetch current categories
        const existing = await graphFetch(
          `/me/messages/${messageId}?$select=categories`,
          credentials,
        ) as { categories?: string[] };

        const currentCategories = existing.categories ?? [];

        // Case-insensitive merge
        const lowerSet = new Set(currentCategories.map((c) => c.toLowerCase()));
        const merged = [...currentCategories];

        if (addCategories) {
          for (const cat of addCategories) {
            if (!lowerSet.has(cat.toLowerCase())) {
              merged.push(cat);
              lowerSet.add(cat.toLowerCase());
            }
          }
        }

        if (removeCategories) {
          const removeLower = new Set(removeCategories.map((c) => c.toLowerCase()));
          const filtered = merged.filter((c) => !removeLower.has(c.toLowerCase()));
          merged.length = 0;
          merged.push(...filtered);
        }

        await graphFetch(`/me/messages/${messageId}`, credentials, {
          method: 'PATCH',
          body: { categories: merged },
        });

        return { messageId, categories: merged };
      }

      case 'outlook_mail_archive': {
        const messageId = params.messageId as string;
        validatePathSegment(messageId, 'messageId');

        await graphFetch(`/me/messages/${messageId}/move`, credentials, {
          method: 'POST',
          body: { destinationId: 'archive' },
        });

        return { messageId, archived: true };
      }

      case 'outlook_mail_list_folders': {
        const data = await graphFetch(
          '/me/mailFolders?$top=100&$select=id,displayName,totalItemCount,unreadItemCount',
          credentials,
        ) as { value?: Array<Record<string, unknown>> };

        const folders = (data.value ?? []).map((f) => ({
          id: f.id as string,
          displayName: f.displayName as string,
          totalItemCount: f.totalItemCount as number,
          unreadItemCount: f.unreadItemCount as number,
        }));

        return { folders };
      }

      case 'outlook_mail_move': {
        const messageId = params.messageId as string;
        const folderId = params.folderId as string;

        validatePathSegment(messageId, 'messageId');

        // Check protected folders
        const protectedFolders = (guards?.protected_folders as string[]) ?? ['deleteditems', 'junkemail'];
        if (protectedFolders.some((pf) => pf.toLowerCase() === folderId.toLowerCase())) {
          throw new GateletError(`Cannot move to protected folder: ${folderId}`);
        }

        await graphFetch(`/me/messages/${messageId}/move`, credentials, {
          method: 'POST',
          body: { destinationId: folderId },
        });

        return { messageId, movedTo: folderId };
      }

      case 'outlook_mail_flag': {
        const messageId = params.messageId as string;
        const flagStatus = params.flagStatus as string | undefined;
        const importance = params.importance as string | undefined;

        if (!flagStatus && !importance) {
          return { messageId, modified: false, reason: 'No flag or importance to set' };
        }

        validatePathSegment(messageId, 'messageId');

        const VALID_FLAG_STATUSES = ['flagged', 'notFlagged', 'complete'];
        const VALID_IMPORTANCES = ['low', 'normal', 'high'];

        if (flagStatus && !VALID_FLAG_STATUSES.includes(flagStatus)) {
          throw new GateletError(`Invalid flagStatus: ${flagStatus}. Must be one of: ${VALID_FLAG_STATUSES.join(', ')}`);
        }
        if (importance && !VALID_IMPORTANCES.includes(importance)) {
          throw new GateletError(`Invalid importance: ${importance}. Must be one of: ${VALID_IMPORTANCES.join(', ')}`);
        }

        const body: Record<string, unknown> = {};
        if (flagStatus) body.flag = { flagStatus };
        if (importance) body.importance = importance;

        await graphFetch(`/me/messages/${messageId}`, credentials, {
          method: 'PATCH',
          body,
        });

        return { messageId, flagStatus, importance };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async refreshCredentials(
    credentials: Record<string, unknown>,
    oauthClientInfo: { clientId: string; clientSecret?: string },
  ): Promise<Record<string, unknown>> {
    return {
      ...await refreshMicrosoftTokens(credentials, oauthClientInfo),
      account_email: credentials.account_email,
    };
  }
}
