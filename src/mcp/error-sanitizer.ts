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
      agentMessage: `Resource not found for ${toolName}. Verify the ID is correct — the resource may have been deleted or you may not have access.`,
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
    const fieldMatch = raw.match(/required.*field.*"(\w+)"|missing.*param.*"(\w+)"/i);
    const field = fieldMatch?.[1] ?? fieldMatch?.[2];
    const agentMessage = field
      ? `Invalid request for ${toolName}: the field '${field}' may be missing or incorrect.`
      : `Invalid request for ${toolName}. Double-check required fields like IDs and dates.`;
    return { agentMessage, logMessage };
  }

  return {
    agentMessage: `${toolName} encountered an unexpected error. Try the request again. If it persists, the admin may need to check the connection.`,
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
