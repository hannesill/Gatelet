import type { ParsedMessage, ContentFilterResult, SearchResultSummary } from './types.js';

function isSubjectBlocked(
  subject: string,
  blockSubjects: string[],
): string | null {
  const subjectLower = subject.toLowerCase();
  for (const pattern of blockSubjects) {
    if (subjectLower.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  return null;
}

function isDomainBlocked(
  from: string,
  blockDomains: string[],
): string | null {
  const domain = extractDomain(from);
  if (!domain) return null;
  const domainLower = domain.toLowerCase();
  for (const blockedDomain of blockDomains) {
    const blocked = blockedDomain.toLowerCase();
    if (domainLower === blocked || domainLower.endsWith('.' + blocked)) {
      return blockedDomain;
    }
  }
  return null;
}

export function applyContentFilters(
  message: ParsedMessage,
  guards: Record<string, unknown>,
): ContentFilterResult {
  // 1. Check subject blocks
  const blockSubjects = guards.block_subjects as string[] | undefined;
  if (blockSubjects) {
    const matched = isSubjectBlocked(message.subject, blockSubjects);
    if (matched) {
      return {
        blocked: true,
        reason: `Message blocked by content filter: subject matches '${matched}'`,
        messageId: message.id,
        from: '[blocked]',
        subject: '[blocked]',
        snippet: '[content hidden]',
      };
    }
  }

  // 2. Check sender domain blocks
  const blockSenderDomains = guards.block_sender_domains as string[] | undefined;
  if (blockSenderDomains) {
    const matched = isDomainBlocked(message.from, blockSenderDomains);
    if (matched) {
      return {
        blocked: true,
        reason: `Message blocked by content filter: sender domain matches '${matched}'`,
        messageId: message.id,
        from: '[blocked]',
        subject: '[blocked]',
        snippet: '[content hidden]',
      };
    }
  }

  // 3. Apply PII redaction
  const redactPatterns = guards.redact_patterns as Array<{ pattern: string; replace: string }> | undefined;
  let body = message.body;
  let snippet = message.snippet;
  if (redactPatterns) {
    for (const rule of redactPatterns) {
      try {
        const re = new RegExp(rule.pattern, 'gi');
        body = body.replace(re, rule.replace);
        snippet = snippet.replace(re, rule.replace);
      } catch {
        // Invalid regex — skip
      }
    }
  }

  return {
    blocked: false,
    message: { ...message, body, snippet },
  };
}

export function filterSearchResult(
  result: SearchResultSummary,
  guards: Record<string, unknown>,
): SearchResultSummary {
  // 1. Check subject blocks
  const blockSubjects = guards.block_subjects as string[] | undefined;
  if (blockSubjects && isSubjectBlocked(result.subject, blockSubjects)) {
    return { ...result, from: '[filtered]', subject: '[filtered]', snippet: '[content hidden]' };
  }

  // 2. Check sender domain blocks
  const blockSenderDomains = guards.block_sender_domains as string[] | undefined;
  if (blockSenderDomains && isDomainBlocked(result.from, blockSenderDomains)) {
    return { ...result, from: '[filtered]', subject: '[filtered]', snippet: '[content hidden]' };
  }

  // 3. Apply PII redaction to snippet
  const redactPatterns = guards.redact_patterns as Array<{ pattern: string; replace: string }> | undefined;
  let snippet = result.snippet;
  if (redactPatterns) {
    for (const rule of redactPatterns) {
      try {
        const re = new RegExp(rule.pattern, 'gi');
        snippet = snippet.replace(re, rule.replace);
      } catch {
        // Invalid regex — skip
      }
    }
  }

  return { ...result, snippet };
}

function extractDomain(from: string): string | undefined {
  // Handle "Name <user@domain.com>" or plain "user@domain.com"
  const match = from.match(/@([^\s>]+)/);
  return match?.[1];
}
