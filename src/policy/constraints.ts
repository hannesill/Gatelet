import type { Constraint } from './types.js';
import { getByPath } from './field-path.js';

export function evaluateConstraint(
  constraint: Constraint,
  params: Record<string, unknown>,
): { ok: boolean; reason?: string } {
  const actual = getByPath(params, constraint.field);

  switch (constraint.rule) {
    case 'must_equal': {
      if (actual !== constraint.value) {
        return {
          ok: false,
          reason: `Constraint failed: ${constraint.field} must_equal ${JSON.stringify(constraint.value)}, got ${JSON.stringify(actual)}`,
        };
      }
      return { ok: true };
    }

    case 'must_be_one_of': {
      const allowed = constraint.value as unknown[];
      if (!Array.isArray(allowed) || !allowed.includes(actual)) {
        return {
          ok: false,
          reason: `Constraint failed: ${constraint.field} must_be_one_of ${JSON.stringify(constraint.value)}, got ${JSON.stringify(actual)}`,
        };
      }
      return { ok: true };
    }

    case 'must_not_be_empty': {
      if (
        actual == null ||
        actual === '' ||
        (Array.isArray(actual) && actual.length === 0)
      ) {
        return {
          ok: false,
          reason: `Constraint failed: ${constraint.field} must_not_be_empty, got ${JSON.stringify(actual)}`,
        };
      }
      return { ok: true };
    }

    case 'must_match': {
      let regex: RegExp;
      try {
        regex = new RegExp(constraint.value as string);
      } catch {
        return { ok: false, reason: `Constraint failed: ${constraint.field} must_match has invalid regex: ${JSON.stringify(constraint.value)}` };
      }
      if (actual == null) {
        return {
          ok: false,
          reason: `Constraint failed: ${constraint.field} must_match ${JSON.stringify(constraint.value)}, got ${JSON.stringify(actual)}`,
        };
      }
      const str = typeof actual === 'string' ? actual : JSON.stringify(actual);
      if (!regex.test(str)) {
        return {
          ok: false,
          reason: `Constraint failed: ${constraint.field} must_match ${JSON.stringify(constraint.value)}, got ${JSON.stringify(actual)}`,
        };
      }
      return { ok: true };
    }

    default:
      return { ok: false, reason: `Unknown constraint rule: ${(constraint as Constraint).rule}` };
  }
}
