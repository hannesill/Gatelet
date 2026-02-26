import { parse, stringify } from 'yaml';

// --- Types ---

export interface PolicyFormState {
  provider: string;
  account: string;
  operations: OperationFormState[];
}

export interface OperationFormState {
  name: string;
  allow: boolean;
  constraints: ConstraintFormState[];
  mutations: MutationFormState[];
  guards: string;
  guardsParseError: string | null;
  fieldFilterMode: 'none' | 'allowed' | 'denied';
  allowed_fields: string[];
  denied_fields: string[];
}

export interface ConstraintFormState {
  id: string;
  field: string;
  rule: string;
  value: string;
}

export interface MutationFormState {
  id: string;
  field: string;
  action: string;
  value: string;
}

// --- Backend-compatible config shape ---

interface PolicyConfig {
  provider: string;
  account: string;
  operations: Record<string, OperationPolicy>;
}

interface OperationPolicy {
  allow: boolean;
  constraints?: Array<{ field: string; rule: string; value?: unknown }>;
  mutations?: Array<{ field: string; action: string; value?: unknown }>;
  guards?: Record<string, unknown>;
  allowed_fields?: string[];
  denied_fields?: string[];
}

// --- Parse / Stringify ---

export function parsePolicyYaml(yaml: string): PolicyConfig {
  return parse(yaml) as PolicyConfig;
}

export function stringifyPolicyYaml(config: PolicyConfig): string {
  // Strip empty arrays/objects for clean YAML
  const cleaned: PolicyConfig = {
    provider: config.provider,
    account: config.account,
    operations: {},
  };

  for (const [name, op] of Object.entries(config.operations)) {
    const cleanOp: OperationPolicy = { allow: op.allow };
    if (op.constraints && op.constraints.length > 0) cleanOp.constraints = op.constraints;
    if (op.mutations && op.mutations.length > 0) cleanOp.mutations = op.mutations;
    if (op.guards && Object.keys(op.guards).length > 0) cleanOp.guards = op.guards;
    if (op.allowed_fields && op.allowed_fields.length > 0) cleanOp.allowed_fields = op.allowed_fields;
    if (op.denied_fields && op.denied_fields.length > 0) cleanOp.denied_fields = op.denied_fields;
    cleaned.operations[name] = cleanOp;
  }

  return stringify(cleaned, { indent: 2, lineWidth: 0 });
}

// --- Form State Conversions ---

function constraintValueToString(rule: string, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ');
  return String(value);
}

function mutationValueToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function configToFormState(config: PolicyConfig): PolicyFormState {
  const operations: OperationFormState[] = [];

  for (const [name, op] of Object.entries(config.operations)) {
    const constraints: ConstraintFormState[] = (op.constraints ?? []).map(c => ({
      id: crypto.randomUUID(),
      field: c.field,
      rule: c.rule,
      value: constraintValueToString(c.rule, c.value),
    }));

    const mutations: MutationFormState[] = (op.mutations ?? []).map(m => ({
      id: crypto.randomUUID(),
      field: m.field,
      action: m.action,
      value: mutationValueToString(m.value),
    }));

    let guards = '';
    if (op.guards && Object.keys(op.guards).length > 0) {
      guards = JSON.stringify(op.guards, null, 2);
    }

    let fieldFilterMode: 'none' | 'allowed' | 'denied' = 'none';
    if (op.allowed_fields && op.allowed_fields.length > 0) fieldFilterMode = 'allowed';
    else if (op.denied_fields && op.denied_fields.length > 0) fieldFilterMode = 'denied';

    operations.push({
      name,
      allow: op.allow,
      constraints,
      mutations,
      guards,
      guardsParseError: null,
      fieldFilterMode,
      allowed_fields: op.allowed_fields ?? [],
      denied_fields: op.denied_fields ?? [],
    });
  }

  return { provider: config.provider, account: config.account, operations };
}

function parseConstraintValue(rule: string, valueStr: string): unknown {
  if (rule === 'must_not_be_empty') return undefined;

  if (rule === 'must_be_one_of') {
    return valueStr.split(',').map(s => {
      const trimmed = s.trim();
      try { return JSON.parse(trimmed); } catch { return trimmed; }
    });
  }

  // must_equal, must_match — try JSON parse, fall back to string
  try { return JSON.parse(valueStr); } catch { return valueStr; }
}

function parseMutationValue(action: string, valueStr: string): unknown {
  if (action === 'delete') return undefined;
  try { return JSON.parse(valueStr); } catch { return valueStr; }
}

export function formStateToConfig(state: PolicyFormState): PolicyConfig {
  const operations: Record<string, OperationPolicy> = {};

  for (const op of state.operations) {
    const entry: OperationPolicy = { allow: op.allow };

    if (op.constraints.length > 0) {
      entry.constraints = op.constraints.map(c => {
        const base: { field: string; rule: string; value?: unknown } = { field: c.field, rule: c.rule };
        const val = parseConstraintValue(c.rule, c.value);
        if (val !== undefined) base.value = val;
        return base;
      });
    }

    if (op.mutations.length > 0) {
      entry.mutations = op.mutations.map(m => {
        const base: { field: string; action: string; value?: unknown } = { field: m.field, action: m.action };
        const val = parseMutationValue(m.action, m.value);
        if (val !== undefined) base.value = val;
        return base;
      });
    }

    if (op.guards.trim()) {
      try {
        entry.guards = JSON.parse(op.guards);
      } catch {
        // leave guards undefined if parse fails
      }
    }

    if (op.fieldFilterMode === 'allowed' && op.allowed_fields.length > 0) {
      entry.allowed_fields = op.allowed_fields;
    } else if (op.fieldFilterMode === 'denied' && op.denied_fields.length > 0) {
      entry.denied_fields = op.denied_fields;
    }

    operations[op.name] = entry;
  }

  return { provider: state.provider, account: state.account, operations };
}
