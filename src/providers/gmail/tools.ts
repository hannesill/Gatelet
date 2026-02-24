import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const gmailTools: ToolDefinition[] = [
  {
    name: 'gmail_search',
    description:
      'Search Gmail messages. Supports Gmail search syntax: "is:unread", "from:person@example.com", ' +
      '"subject:meeting", "after:2026/01/01", "has:attachment", "in:inbox". ' +
      'Returns message IDs and snippets. Use gmail_read_message to get full content.',
    policyOperation: 'search',
    inputSchema: {
      q: z.string().optional().describe('Gmail search query. Omit to list recent inbox messages.'),
      maxResults: z.number().optional().describe('Max messages to return (default 10, max 50)'),
    },
  },
  {
    name: 'gmail_read_message',
    description:
      'Read the full content of a Gmail message by ID. Returns parsed headers (from, to, subject, date) ' +
      'and plaintext body. Some messages may be blocked by content filters (2FA codes, password resets).',
    policyOperation: 'read_message',
    inputSchema: {
      messageId: z.string().describe('Gmail message ID (from gmail_search results)'),
    },
  },
  {
    name: 'gmail_create_draft',
    description:
      'Create a new draft email. The draft is saved but NOT sent — the user must review and send manually.',
    policyOperation: 'create_draft',
    inputSchema: {
      to: z.string().describe('Recipient email address(es), comma-separated'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body in plain text'),
      cc: z.string().optional().describe('CC address(es), comma-separated'),
      bcc: z.string().optional().describe('BCC address(es), comma-separated'),
      inReplyTo: z.string().optional().describe('Message-ID header of the message being replied to'),
      threadId: z.string().optional().describe('Thread ID to associate the draft with (for replies)'),
    },
  },
  {
    name: 'gmail_list_drafts',
    description: 'List existing draft emails. Returns draft IDs and message snippets.',
    policyOperation: 'list_drafts',
    inputSchema: {
      maxResults: z.number().optional().describe('Max drafts to return (default 10, max 50)'),
    },
  },
];
