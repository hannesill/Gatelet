import { stringify } from 'yaml';
import { defaultPolicyYaml } from './default-policy.js';

// Shared security guards for read_message — single source of truth.
// Duplicating these across presets is a security risk (one gets updated, another doesn't).
const READ_MESSAGE_GUARDS = {
  block_subjects: [
    'password reset',
    'reset your password',
    'verification code',
    'security code',
    'two-factor',
    '2FA',
    'one-time password',
    'OTP',
    'sign-in attempt',
    'login alert',
    'security alert',
    'confirm your identity',
  ],
  block_sender_domains: [
    'accounts.google.com',
    'accountprotection.microsoft.com',
    'account.live.com',
    'login.microsoftonline.com',
  ],
  redact_patterns: [
    { pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replace: '[REDACTED-SSN]' },
    { pattern: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b', replace: '[REDACTED-CC]' },
    { pattern: '\\b\\d{4}[\\s-]?\\d{6}[\\s-]?\\d{5}\\b', replace: '[REDACTED-CC]' },
    { pattern: '\\bCVV[:\\s]*\\d{3,4}\\b', replace: 'CVV [REDACTED]' },
    { pattern: '\\b[A-Z]{1,2}\\d{6,9}\\b', replace: '[REDACTED-PASSPORT]' },
    { pattern: '\\brouting[:\\s#]*\\d{9}\\b', replace: 'routing [REDACTED]' },
    { pattern: '\\baccount[:\\s#]*\\d{8,17}\\b', replace: 'account [REDACTED]' },
  ],
};

const SEARCH_OP = {
  allow: true,
  mutations: [{ field: 'maxResults', action: 'set', value: 10 }],
};

const LIST_DRAFTS_OP = {
  allow: true,
  mutations: [{ field: 'maxResults', action: 'set', value: 10 }],
};

function buildPreset(operations: Record<string, unknown>): string {
  return stringify({
    provider: 'outlook_mail',
    account: '{account}',
    operations,
  });
}

export const presets: Record<string, string> = {
  'read-only': buildPreset({
    search: SEARCH_OP,
    read_message: { allow: true, guards: READ_MESSAGE_GUARDS },
    list_drafts: LIST_DRAFTS_OP,
  }),

  'standard': defaultPolicyYaml,

  'full-access': buildPreset({
    search: SEARCH_OP,
    read_message: { allow: true, guards: READ_MESSAGE_GUARDS },
    create_draft: {
      allow: true,
      constraints: [
        { field: 'to', rule: 'must_not_be_empty' },
        { field: 'subject', rule: 'must_not_be_empty' },
      ],
      mutations: [
        { field: 'cc', action: 'delete' },
        { field: 'bcc', action: 'delete' },
      ],
    },
    list_drafts: LIST_DRAFTS_OP,
    send: {
      allow: true,
      constraints: [
        { field: 'to', rule: 'must_not_be_empty' },
        { field: 'subject', rule: 'must_not_be_empty' },
      ],
      mutations: [
        { field: 'cc', action: 'delete' },
        { field: 'bcc', action: 'delete' },
      ],
    },
    reply: {
      allow: true,
      constraints: [
        { field: 'messageId', rule: 'must_not_be_empty' },
        { field: 'body', rule: 'must_not_be_empty' },
      ],
      mutations: [{ field: 'replyAll', action: 'set', value: false }],
    },
    categorize: { allow: true },
    archive: { allow: true },
  }),
};
