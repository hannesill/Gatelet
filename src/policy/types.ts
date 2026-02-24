export interface PolicyConfig {
  provider: string;
  account: string;
  operations: Record<string, OperationPolicy>;
}

export interface OperationPolicy {
  allow: boolean;
  constraints?: Constraint[];
  mutations?: Mutation[];
}

export interface Constraint {
  field: string;
  rule: 'must_equal' | 'must_be_one_of' | 'must_not_be_empty';
  value?: unknown;
}

export interface Mutation {
  field: string;
  action: 'set' | 'delete';
  value?: unknown;
}

export type PolicyResult =
  | { action: 'deny'; reason: string }
  | { action: 'allow'; mutatedParams: Record<string, unknown> };
