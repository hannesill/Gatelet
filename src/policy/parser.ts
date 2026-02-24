import YAML from 'yaml';
import type { PolicyConfig, ParseResult } from './types.js';

const VALID_CONSTRAINT_RULES = ['must_equal', 'must_be_one_of', 'must_not_be_empty'] as const;
const VALID_MUTATION_ACTIONS = ['set', 'delete'] as const;
const KNOWN_TOP_LEVEL_KEYS = ['provider', 'account', 'operations'];
const KNOWN_OPERATION_KEYS = ['allow', 'constraints', 'mutations', 'guards'];

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
