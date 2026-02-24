import type { ParsedMessage } from '../email/types.js';
import { stripHtml } from '../email/html.js';

export function parseMessage(raw: Record<string, unknown>): ParsedMessage {
  const payload = raw.payload as Record<string, unknown> | undefined;
  const headers = (payload?.headers as Array<{ name?: string; value?: string }>) ?? [];

  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

  const body = extractBody(payload);
  const hasAttachments = detectAttachments(payload);

  return {
    id: raw.id as string,
    threadId: raw.threadId as string,
    labelIds: (raw.labelIds as string[]) ?? [],
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body: body || (raw.snippet as string) || '',
    snippet: (raw.snippet as string) || '',
    hasAttachments,
  };
}

function extractBody(payload: Record<string, unknown> | undefined): string {
  if (!payload) return '';

  const mimeType = payload.mimeType as string | undefined;
  const body = payload.body as { data?: string } | undefined;
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;

  // Simple text/plain message
  if (mimeType === 'text/plain' && body?.data) {
    return decodeBase64Url(body.data);
  }

  // Simple text/html message (no parts)
  if (mimeType === 'text/html' && body?.data) {
    return stripHtml(decodeBase64Url(body.data));
  }

  // Multipart — recurse into parts
  if (parts) {
    // Prefer text/plain
    const plainPart = findPart(parts, 'text/plain');
    if (plainPart) {
      const data = (plainPart.body as { data?: string })?.data;
      if (data) return decodeBase64Url(data);
    }

    // Fall back to text/html
    const htmlPart = findPart(parts, 'text/html');
    if (htmlPart) {
      const data = (htmlPart.body as { data?: string })?.data;
      if (data) return stripHtml(decodeBase64Url(data));
    }
  }

  return '';
}

function findPart(parts: Array<Record<string, unknown>>, mimeType: string): Record<string, unknown> | undefined {
  for (const part of parts) {
    if ((part.mimeType as string) === mimeType) return part;
    // Recurse into nested parts (e.g. multipart/alternative inside multipart/mixed)
    const nested = part.parts as Array<Record<string, unknown>> | undefined;
    if (nested) {
      const found = findPart(nested, mimeType);
      if (found) return found;
    }
  }
  return undefined;
}

function detectAttachments(payload: Record<string, unknown> | undefined): boolean {
  if (!payload) return false;
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return false;

  for (const part of parts) {
    if (part.filename && (part.filename as string).length > 0) return true;
    const headers = part.headers as Array<{ name?: string; value?: string }> | undefined;
    if (headers) {
      const cd = headers.find((h) => h.name?.toLowerCase() === 'content-disposition');
      if (cd?.value?.toLowerCase().includes('attachment')) return true;
    }
    // Recurse
    const nested = part.parts as Array<Record<string, unknown>> | undefined;
    if (nested && detectAttachments({ parts: nested } as Record<string, unknown>)) return true;
  }
  return false;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}
