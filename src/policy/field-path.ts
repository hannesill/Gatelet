const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function validatePathParts(parts: string[]): void {
  for (const part of parts) {
    if (DANGEROUS_KEYS.has(part)) {
      throw new Error(`Forbidden field path segment: ${part}`);
    }
  }
}

export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  validatePathParts(parts);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.');
  validatePathParts(parts);
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

export function deleteByPath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  validatePathParts(parts);
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      return;
    }
    current = current[part] as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]];
}
