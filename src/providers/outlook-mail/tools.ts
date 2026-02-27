import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const outlookMailTools: ToolDefinition[] = [
  {
    name: 'outlook_mail_search',
    description:
      'Search Outlook Mail messages. Supports KQL search syntax (e.g. "from:person@example.com", ' +
      '"subject:meeting", "hasAttachment:true") and optional OData $filter. ' +
      'Returns message IDs and snippets. Use outlook_mail_read_message to get full content.',
    policyOperation: 'search',
    inputSchema: {
      search: z.string().optional().describe('KQL search query (e.g. "from:user@example.com subject:meeting"). Omit to list recent messages.'),
      filter: z.string().optional().describe('OData $filter expression (e.g. "isRead eq false"). Cannot be combined with $orderby when $search is present.'),
      folderId: z.string().optional().describe('Folder ID to search in (e.g. "Inbox", "SentItems"). Omit to search all folders.'),
      maxResults: z.number().optional().describe('Max messages to return (default 10, max 50)'),
    },
  },
  {
    name: 'outlook_mail_read_message',
    description:
      'Read the full content of an Outlook Mail message by ID. Returns parsed headers (from, to, subject, date) ' +
      'and plaintext body. Some messages may be blocked by content filters (2FA codes, password resets).',
    policyOperation: 'read_message',
    inputSchema: {
      messageId: z.string().describe('Outlook message ID (from outlook_mail_search results)'),
    },
  },
  {
    name: 'outlook_mail_create_draft',
    description:
      'Create a new draft email in Outlook. The draft is saved but NOT sent — the user must review and send manually.',
    policyOperation: 'create_draft',
    inputSchema: {
      to: z.string().describe('Recipient email address(es), comma-separated'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body in plain text'),
      cc: z.string().optional().describe('CC address(es), comma-separated'),
      bcc: z.string().optional().describe('BCC address(es), comma-separated'),
      conversationId: z.string().optional().describe('Conversation ID to associate the draft with (for replies)'),
    },
  },
  {
    name: 'outlook_mail_list_drafts',
    description: 'List existing draft emails in Outlook. Returns draft IDs and message snippets.',
    policyOperation: 'list_drafts',
    inputSchema: {
      maxResults: z.number().optional().describe('Max drafts to return (default 10, max 50)'),
    },
  },
  {
    name: 'outlook_mail_send',
    description:
      'Send an email directly via Outlook. The email is sent immediately — use outlook_mail_create_draft if the user should review first.',
    policyOperation: 'send',
    inputSchema: {
      to: z.string().describe('Recipient email address(es), comma-separated'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body in plain text'),
      from: z.string().optional().describe('Sender address (alias). If omitted, uses account default.'),
      cc: z.string().optional().describe('CC address(es), comma-separated'),
      bcc: z.string().optional().describe('BCC address(es), comma-separated'),
    },
  },
  {
    name: 'outlook_mail_reply',
    description:
      'Reply to an existing Outlook email. Uses the Graph API native reply endpoint. ' +
      'The reply is sent immediately.',
    policyOperation: 'reply',
    inputSchema: {
      messageId: z.string().describe('Outlook message ID of the message to reply to'),
      body: z.string().describe('Reply body in plain text'),
      replyAll: z.boolean().optional().describe('If true, reply to all recipients (default: false)'),
    },
  },
  {
    name: 'outlook_mail_categorize',
    description:
      'Add or remove categories from an Outlook message. Uses string category names (e.g. "Blue Category", "Red Category").',
    policyOperation: 'categorize',
    inputSchema: {
      messageId: z.string().describe('Outlook message ID'),
      addCategories: z.array(z.string()).optional().describe('Category names to add'),
      removeCategories: z.array(z.string()).optional().describe('Category names to remove'),
    },
  },
  {
    name: 'outlook_mail_archive',
    description:
      'Archive an Outlook message by moving it to the Archive folder. The message remains accessible via search.',
    policyOperation: 'archive',
    inputSchema: {
      messageId: z.string().describe('Outlook message ID to archive'),
    },
  },
  {
    name: 'outlook_mail_list_folders',
    description:
      'List all mail folders in the Outlook account. Returns folder IDs, display names, and unread counts. ' +
      'Use folder IDs from this list with outlook_mail_move or outlook_mail_search.',
    policyOperation: 'list_folders',
    inputSchema: {},
  },
  {
    name: 'outlook_mail_move',
    description:
      'Move an Outlook message to a different folder. Use well-known folder names ' +
      '(e.g. "Inbox", "Archive", "SentItems") or folder IDs from outlook_mail_list_folders.',
    policyOperation: 'move',
    inputSchema: {
      messageId: z.string().describe('Outlook message ID to move'),
      folderId: z.string().describe('Destination folder ID or well-known name (e.g. "Inbox", "Archive")'),
    },
  },
  {
    name: 'outlook_mail_flag',
    description:
      'Set or clear the follow-up flag and importance level on an Outlook message. ' +
      'Use flagStatus "flagged" to flag, "complete" to mark done, or "notFlagged" to clear.',
    policyOperation: 'flag',
    inputSchema: {
      messageId: z.string().describe('Outlook message ID'),
      flagStatus: z.enum(['flagged', 'notFlagged', 'complete']).optional().describe('Flag status: "flagged", "notFlagged", or "complete"'),
      importance: z.enum(['low', 'normal', 'high']).optional().describe('Message importance: "low", "normal", or "high"'),
    },
  },
];
