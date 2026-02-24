import type { ParsedMessage, ContentFilterResult } from './types.js';

export function applyContentFilters(
  message: ParsedMessage,
  guards: Record<string, unknown>,
): ContentFilterResult {
  // 1. Check subject blocks
  const blockSubjects = guards.block_subjects as string[] | undefined;
  if (blockSubjects) {
    const subjectLower = message.subject.toLowerCase();
    for (const pattern of blockSubjects) {
      if (subjectLower.includes(pattern.toLowerCase())) {
        return {
          blocked: true,
          reason: `Message blocked by content filter: subject matches '${pattern}'`,
          messageId: message.id,
          from: '[blocked]',
          subject: '[blocked]',
          snippet: '[content hidden]',
        };
      }
    }
  }

  // 2. Check sender domain blocks
  const blockSenderDomains = guards.block_sender_domains as string[] | undefined;
  if (blockSenderDomains) {
    const domain = extractDomain(message.from);
    if (domain) {
      const domainLower = domain.toLowerCase();
      for (const blockedDomain of blockSenderDomains) {
        if (domainLower === blockedDomain.toLowerCase()) {
          return {
            blocked: true,
            reason: `Message blocked by content filter: sender domain matches '${blockedDomain}'`,
            messageId: message.id,
            from: '[blocked]',
            subject: '[blocked]',
            snippet: '[content hidden]',
          };
        }
      }
    }
  }

  // 3. Apply PII redaction
  const redactPatterns = guards.redact_patterns as Array<{ pattern: string; replace: string }> | undefined;
  let body = message.body;
  if (redactPatterns) {
    for (const rule of redactPatterns) {
      try {
        const re = new RegExp(rule.pattern, 'gi');
        body = body.replace(re, rule.replace);
      } catch {
        // Invalid regex — skip
      }
    }
  }

  return {
    blocked: false,
    message: { ...message, body },
  };
}

function extractDomain(from: string): string | undefined {
  // Handle "Name <user@domain.com>" or plain "user@domain.com"
  const match = from.match(/@([^\s>]+)/);
  return match?.[1];
}
