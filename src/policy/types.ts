export interface PolicyConfig {
  provider: string;
  account: string;
  operations: Record<string, OperationPolicy>;
}

export interface OperationPolicy {
  allow: boolean;
  constraints?: Constraint[];
  mutations?: Mutation[];
  guards?: Record<string, unknown>;
  allowed_fields?: string[];
  denied_fields?: string[];
}

export interface Constraint {
  field: string;
  rule: 'must_equal' | 'must_be_one_of' | 'must_not_be_empty' | 'must_match';
  value?: unknown;
}

export interface Mutation {
  field: string;
  action: 'set' | 'delete';
  value?: unknown;
}

export interface ParseResult {
  policy: PolicyConfig;
  warnings: string[];
}

export type PolicyResult =
  | { action: 'deny'; reason: string }
  | {
      action: 'allow';
      mutatedParams: Record<string, unknown>;
      guards?: Record<string, unknown>;
      fieldPolicy?: { allowed_fields?: string[]; denied_fields?: string[] };
    };
