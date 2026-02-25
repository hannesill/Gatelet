import type { z } from 'zod';

/**
 * Strip fields from params that are not defined in the tool's inputSchema.
 * Returns a new object with only known fields.
 */
export function stripUnknownParams(
  params: Record<string, unknown>,
  inputSchema: Record<string, z.ZodTypeAny>,
): Record<string, unknown> {
  const knownFields = new Set(Object.keys(inputSchema));
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (knownFields.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Apply policy-level field restrictions.
 * - allowed_fields: only keep listed fields
 * - denied_fields: remove listed fields
 * These are mutually exclusive (enforced by parser).
 */
export function applyFieldPolicy(
  params: Record<string, unknown>,
  fieldPolicy?: { allowed_fields?: string[]; denied_fields?: string[] },
): Record<string, unknown> {
  if (!fieldPolicy) return params;

  if (fieldPolicy.allowed_fields) {
    const allowed = new Set(fieldPolicy.allowed_fields);
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (allowed.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  if (fieldPolicy.denied_fields) {
    const denied = new Set(fieldPolicy.denied_fields);
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!denied.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  return params;
}
