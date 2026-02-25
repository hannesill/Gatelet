import YAML from 'yaml';
import type { PolicyConfig, ParseResult } from './types.js';

const VALID_CONSTRAINT_RULES = ['must_equal', 'must_be_one_of', 'must_not_be_empty', 'must_match'] as const;
const VALID_MUTATION_ACTIONS = ['set', 'delete'] as const;
const KNOWN_TOP_LEVEL_KEYS = ['provider', 'account', 'operations'];
const KNOWN_OPERATION_KEYS = ['allow', 'constraints', 'mutations', 'guards', 'allowed_fields', 'denied_fields'];

export function parsePolicy(yamlString: string): ParseResult {
  const parsed = YAML.parse(yamlString);
  const warnings: string[] = [];

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid policy: must be a YAML object');
  }

  if (typeof parsed.provider !== 'string') {
    throw new Error('Invalid policy: missing "provider" field');
  }

  if (typeof parsed.account !== 'string') {
    throw new Error('Invalid policy: missing "account" field');
  }

  if (!parsed.operations || typeof parsed.operations !== 'object') {
    throw new Error('Invalid policy: missing "operations" object');
  }

  // Warn on unknown top-level keys
  for (const key of Object.keys(parsed)) {
    if (!KNOWN_TOP_LEVEL_KEYS.includes(key)) {
      warnings.push(`Unknown top-level key: "${key}"`);
    }
  }

  // Validate each operation
  for (const [opName, op] of Object.entries(parsed.operations)) {
    if (!op || typeof op !== 'object') {
      throw new Error(`Invalid policy: operation "${opName}" must be an object`);
    }

    const opObj = op as Record<string, unknown>;

    // allow must be a boolean
    if (typeof opObj.allow !== 'boolean') {
      throw new Error(
        `Invalid policy: operation "${opName}" has non-boolean "allow" (got ${typeof opObj.allow}: ${JSON.stringify(opObj.allow)})`,
      );
    }

    // Warn on unknown operation-level keys
    for (const key of Object.keys(opObj)) {
      if (!KNOWN_OPERATION_KEYS.includes(key)) {
        warnings.push(`Unknown key in operation "${opName}": "${key}"`);
      }
    }

    // Validate constraints
    if (opObj.constraints !== undefined) {
      if (!Array.isArray(opObj.constraints)) {
        throw new Error(`Invalid policy: operation "${opName}" constraints must be an array`);
      }
      for (let i = 0; i < opObj.constraints.length; i++) {
        validateConstraint(opName, opObj.constraints[i], i);
      }
    }

    // Validate mutations
    if (opObj.mutations !== undefined) {
      if (!Array.isArray(opObj.mutations)) {
        throw new Error(`Invalid policy: operation "${opName}" mutations must be an array`);
      }
      for (let i = 0; i < opObj.mutations.length; i++) {
        validateMutation(opName, opObj.mutations[i], i);
      }
    }

    // guards are opaque — not validated

    // Validate allowed_fields
    if (opObj.allowed_fields !== undefined) {
      if (!Array.isArray(opObj.allowed_fields)) {
        throw new Error(`Invalid policy: operation "${opName}" allowed_fields must be an array`);
      }
      for (let i = 0; i < opObj.allowed_fields.length; i++) {
        if (typeof opObj.allowed_fields[i] !== 'string') {
          throw new Error(
            `Invalid policy: operation "${opName}" allowed_fields[${i}] must be a string`,
          );
        }
      }
    }

    // Validate denied_fields
    if (opObj.denied_fields !== undefined) {
      if (!Array.isArray(opObj.denied_fields)) {
        throw new Error(`Invalid policy: operation "${opName}" denied_fields must be an array`);
      }
      for (let i = 0; i < opObj.denied_fields.length; i++) {
        if (typeof opObj.denied_fields[i] !== 'string') {
          throw new Error(
            `Invalid policy: operation "${opName}" denied_fields[${i}] must be a string`,
          );
        }
      }
    }

    // Mutually exclusive
    if (opObj.allowed_fields !== undefined && opObj.denied_fields !== undefined) {
      throw new Error(
        `Invalid policy: operation "${opName}" cannot have both allowed_fields and denied_fields`,
      );
    }
  }

  return { policy: parsed as PolicyConfig, warnings };
}

function validateConstraint(opName: string, constraint: unknown, index: number): void {
  if (!constraint || typeof constraint !== 'object') {
    throw new Error(`Invalid policy: constraint #${index} in "${opName}" must be an object`);
  }

  const c = constraint as Record<string, unknown>;

  if (typeof c.field !== 'string') {
    throw new Error(`Invalid policy: constraint #${index} in "${opName}" missing "field" string`);
  }

  if (!VALID_CONSTRAINT_RULES.includes(c.rule as typeof VALID_CONSTRAINT_RULES[number])) {
    throw new Error(
      `Invalid policy: constraint #${index} in "${opName}" has unknown rule "${c.rule}" (must be one of: ${VALID_CONSTRAINT_RULES.join(', ')})`,
    );
  }

  if (c.rule === 'must_equal' && c.value === undefined) {
    throw new Error(
      `Invalid policy: constraint #${index} in "${opName}" with rule "must_equal" requires a "value"`,
    );
  }

  if (c.rule === 'must_be_one_of') {
    if (!Array.isArray(c.value)) {
      throw new Error(
        `Invalid policy: constraint #${index} in "${opName}" with rule "must_be_one_of" requires "value" to be an array`,
      );
    }
  }

  if (c.rule === 'must_match') {
    if (typeof c.value !== 'string') {
      throw new Error(
        `Invalid policy: constraint #${index} in "${opName}" with rule "must_match" requires "value" to be a string`,
      );
    }
    try {
      new RegExp(c.value);
    } catch {
      throw new Error(
        `Invalid policy: constraint #${index} in "${opName}" with rule "must_match" has invalid regex: ${JSON.stringify(c.value)}`,
      );
    }
  }
}

function validateMutation(opName: string, mutation: unknown, index: number): void {
  if (!mutation || typeof mutation !== 'object') {
    throw new Error(`Invalid policy: mutation #${index} in "${opName}" must be an object`);
  }

  const m = mutation as Record<string, unknown>;

  if (typeof m.field !== 'string') {
    throw new Error(`Invalid policy: mutation #${index} in "${opName}" missing "field" string`);
  }

  if (!VALID_MUTATION_ACTIONS.includes(m.action as typeof VALID_MUTATION_ACTIONS[number])) {
    throw new Error(
      `Invalid policy: mutation #${index} in "${opName}" has unknown action "${m.action}" (must be one of: ${VALID_MUTATION_ACTIONS.join(', ')})`,
    );
  }

  if (m.action === 'set' && m.value === undefined) {
    throw new Error(
      `Invalid policy: mutation #${index} in "${opName}" with action "set" requires a "value"`,
    );
  }
}
