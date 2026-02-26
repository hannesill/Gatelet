interface SanitizedError {
  agentMessage: string;
  logMessage: string;
}

/**
 * Classify an upstream error into a safe agent-facing message
 * and a detailed server-side log message.
 */
export function sanitizeUpstreamError(
  err: unknown,
  toolName: string,
): SanitizedError {
  const raw = err instanceof Error ? err.message : String(err);
  const logMessage = `[${toolName}] ${raw}`;

  if (isAuthError(raw)) {
    return {
      agentMessage: `Authentication error for ${toolName}. The connection may need to be re-authorized by the admin.`,
      logMessage,
    };
  }

  if (isRateLimitError(raw)) {
    return {
      agentMessage: `Rate limit exceeded for ${toolName}. Try again later.`,
      logMessage,
    };
  }

  if (isNotFoundError(raw)) {
    return {
      agentMessage: `Resource not found for ${toolName}. The ID may be incorrect or the resource may have been deleted.`,
      logMessage,
    };
  }

  if (isPermissionError(raw)) {
    return {
      agentMessage: `Permission denied for ${toolName}. The connected account may not have access to this resource.`,
      logMessage,
    };
  }

  if (isValidationError(raw)) {
    return {
      agentMessage: `Invalid request for ${toolName}. Check the parameters and try again.`,
      logMessage,
    };
  }

  return {
    agentMessage: `${toolName} failed. The error has been logged. Try again or contact the admin if the problem persists.`,
    logMessage,
  };
}

function isAuthError(msg: string): boolean {
  return /invalid_grant|token.*expired|unauthorized|401/i.test(msg);
}

function isRateLimitError(msg: string): boolean {
  return /rate.?limit|too many requests|429|quota/i.test(msg);
}

function isNotFoundError(msg: string): boolean {
  return /not.?found|404|does not exist/i.test(msg);
}

function isPermissionError(msg: string): boolean {
  return /forbidden|403|insufficient.*permission|access.*denied/i.test(msg);
}

function isValidationError(msg: string): boolean {
  return /400|bad request|required.*field|missing.*param|invalid.*argument/i.test(msg);
}
