export interface ParsedMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  hasAttachments: boolean;
}

export interface ContentFilterResult {
  blocked: boolean;
  reason?: string;
  messageId?: string;
  from?: string;
  subject?: string;
  snippet?: string;
  message?: ParsedMessage;
}
