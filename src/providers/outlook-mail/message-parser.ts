import type { ParsedMessage } from '../email/types.js';
import { stripHtml } from '../email/html.js';

interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}

interface GraphMessage {
  id?: string;
  conversationId?: string;
  categories?: string[];
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  subject?: string;
  receivedDateTime?: string;
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
  hasAttachments?: boolean;
}

function formatRecipient(r: GraphRecipient): string {
  const name = r.emailAddress?.name;
  const address = r.emailAddress?.address;
  if (name && address) return `${name} <${address}>`;
  return address ?? name ?? '';
}

function formatRecipientList(recipients: GraphRecipient[] | undefined): string {
  if (!recipients?.length) return '';
  return recipients.map(formatRecipient).join(', ');
}

export function parseGraphMessage(raw: Record<string, unknown>): ParsedMessage {
  const msg = raw as unknown as GraphMessage;

  const bodyContent = msg.body?.content ?? '';
  const isHtml = msg.body?.contentType?.toLowerCase() === 'html';
  const body = isHtml ? stripHtml(bodyContent) : bodyContent;

  return {
    id: msg.id ?? '',
    threadId: msg.conversationId ?? '',
    labelIds: msg.categories ?? [],
    from: msg.from ? formatRecipient(msg.from) : '',
    to: formatRecipientList(msg.toRecipients),
    cc: formatRecipientList(msg.ccRecipients),
    subject: msg.subject ?? '',
    date: msg.receivedDateTime ?? '',
    body: body || msg.bodyPreview || '',
    snippet: msg.bodyPreview ?? '',
    hasAttachments: msg.hasAttachments ?? false,
  };
}
