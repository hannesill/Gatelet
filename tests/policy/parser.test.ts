import { describe, it, expect } from 'vitest';
import { parsePolicy } from '../../src/policy/parser.js';

describe('parsePolicy', () => {
  const VALID_YAML = `
provider: google_calendar
account: test@gmail.com
operations:
  list_events:
    allow: true
  create_event:
    allow: true
    constraints:
      - field: calendarId
        rule: must_equal
        value: primary
    mutations:
      - field: visibility
        action: set
        value: private
      - field: attendees
        action: delete
`;

  // ── Valid policies ─────────────────────────────────────────────────

  it('parses a valid policy and returns no warnings', () => {
    const { policy, warnings } = parsePolicy(VALID_YAML);
    expect(warnings).toHaveLength(0);
    expect(policy.provider).toBe('google_calendar');
    expect(policy.account).toBe('test@gmail.com');
    expect(policy.operations.list_events.allow).toBe(true);
    expect(policy.operations.create_event.constraints).toHaveLength(1);
    expect(policy.operations.create_event.mutations).toHaveLength(2);
  });

  it('accepts must_be_one_of with array value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: color
        rule: must_be_one_of
        value: [red, blue, green]
`;
    const { policy, warnings } = parsePolicy(yaml);
    expect(warnings).toHaveLength(0);
    expect(policy.operations.op.constraints![0].value).toEqual(['red', 'blue', 'green']);
  });

  it('accepts must_not_be_empty without value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: name
        rule: must_not_be_empty
`;
    const { policy } = parsePolicy(yaml);
    expect(policy.operations.op.constraints![0].rule).toBe('must_not_be_empty');
  });

  it('accepts operations with guards (non-redact guards are opaque)', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    guards:
      max_results: 100
      anything: [1, 2, 3]
`;
    const { policy, warnings } = parsePolicy(yaml);
    expect(warnings).toHaveLength(0);
    expect(policy.operations.op.guards).toBeDefined();
  });

  it('accepts guards with valid redact_patterns', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    guards:
      redact_patterns:
        - pattern: "\\\\b\\\\d{3}-\\\\d{2}-\\\\d{4}\\\\b"
          replace: "[REDACTED]"
`;
    const { policy, warnings } = parsePolicy(yaml);
    expect(warnings).toHaveLength(0);
    expect(policy.operations.op.guards).toBeDefined();
  });

  it('throws on guards with invalid redact_patterns regex', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    guards:
      redact_patterns:
        - pattern: "[invalid("
          replace: "X"
`;
    expect(() => parsePolicy(yaml)).toThrow('invalid regex');
  });

  it('throws on guards with unsafe redact_patterns regex (ReDoS)', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    guards:
      redact_patterns:
        - pattern: "(a+)+"
          replace: "X"
`;
    expect(() => parsePolicy(yaml)).toThrow('unsafe regex');
  });

  it('accepts allow: false operations', () => {
    const yaml = `
provider: test
account: a
operations:
  dangerous_op:
    allow: false
`;
    const { policy } = parsePolicy(yaml);
    expect(policy.operations.dangerous_op.allow).toBe(false);
  });

  it('accepts must_match with valid regex string', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: from
        rule: must_match
        value: "^user\\\\+.*@example\\\\.com$"
`;
    const { policy, warnings } = parsePolicy(yaml);
    expect(warnings).toHaveLength(0);
    expect(policy.operations.op.constraints![0].rule).toBe('must_match');
  });

  it('throws on must_match with non-string value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: x
        rule: must_match
        value: [1, 2, 3]
`;
    expect(() => parsePolicy(yaml)).toThrow('requires "value" to be a string');
  });

  it('throws on must_match with invalid regex', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: x
        rule: must_match
        value: "[invalid("
`;
    expect(() => parsePolicy(yaml)).toThrow('invalid regex');
  });

  // ── Top-level errors ──────────────────────────────────────────────

  it('throws on non-object YAML', () => {
    expect(() => parsePolicy('just a string')).toThrow('must be a YAML object');
  });

  it('throws on missing provider', () => {
    expect(() => parsePolicy('account: a\noperations:\n  op:\n    allow: true')).toThrow('missing "provider"');
  });

  it('throws on missing account', () => {
    expect(() => parsePolicy('provider: x\noperations:\n  op:\n    allow: true')).toThrow('missing "account"');
  });

  it('throws on missing operations', () => {
    expect(() => parsePolicy('provider: x\naccount: a')).toThrow('missing "operations"');
  });

  // ── allow validation ──────────────────────────────────────────────

  it('throws when allow is a string', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: "yes"
`;
    expect(() => parsePolicy(yaml)).toThrow('non-boolean "allow"');
  });

  it('throws when allow is missing', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    constraints: []
`;
    expect(() => parsePolicy(yaml)).toThrow('non-boolean "allow"');
  });

  it('throws when allow is a number', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: 1
`;
    expect(() => parsePolicy(yaml)).toThrow('non-boolean "allow"');
  });

  // ── Constraint validation ─────────────────────────────────────────

  it('throws on unknown constraint rule', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: x
        rule: must_match_regex
        value: ".*"
`;
    expect(() => parsePolicy(yaml)).toThrow('unknown rule "must_match_regex"');
  });

  it('throws on constraint with non-string field', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: 123
        rule: must_equal
        value: x
`;
    expect(() => parsePolicy(yaml)).toThrow('missing "field" string');
  });

  it('throws on must_equal without value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: x
        rule: must_equal
`;
    expect(() => parsePolicy(yaml)).toThrow('requires a "value"');
  });

  it('throws on must_be_one_of with non-array value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints:
      - field: x
        rule: must_be_one_of
        value: not-an-array
`;
    expect(() => parsePolicy(yaml)).toThrow('requires "value" to be an array');
  });

  it('throws on non-array constraints', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    constraints: "not an array"
`;
    expect(() => parsePolicy(yaml)).toThrow('constraints must be an array');
  });

  // ── Mutation validation ───────────────────────────────────────────

  it('throws on unknown mutation action', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations:
      - field: x
        action: encrypt
        value: key
`;
    expect(() => parsePolicy(yaml)).toThrow('unknown action "encrypt"');
  });

  it('throws on mutation with non-string field', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations:
      - field: 42
        action: delete
`;
    expect(() => parsePolicy(yaml)).toThrow('missing "field" string');
  });

  it('throws on set mutation without value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations:
      - field: x
        action: set
`;
    expect(() => parsePolicy(yaml)).toThrow('requires a "value"');
  });

  it('accepts delete mutation without value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations:
      - field: x
        action: delete
`;
    const { policy } = parsePolicy(yaml);
    expect(policy.operations.op.mutations![0].action).toBe('delete');
  });

  it('accepts cap mutation with numeric value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations:
      - field: maxResults
        action: cap
        value: 50
`;
    const { policy, warnings } = parsePolicy(yaml);
    expect(warnings).toHaveLength(0);
    expect(policy.operations.op.mutations![0]).toEqual({
      field: 'maxResults',
      action: 'cap',
      value: 50,
    });
  });

  it('throws on cap mutation without value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations:
      - field: maxResults
        action: cap
`;
    expect(() => parsePolicy(yaml)).toThrow('requires a numeric "value"');
  });

  it('throws on cap mutation with non-numeric value', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations:
      - field: maxResults
        action: cap
        value: "fifty"
`;
    expect(() => parsePolicy(yaml)).toThrow('requires a numeric "value"');
  });

  it('throws on non-array mutations', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    mutations: "not an array"
`;
    expect(() => parsePolicy(yaml)).toThrow('mutations must be an array');
  });

  // ── Warnings ──────────────────────────────────────────────────────

  it('warns on unknown top-level keys', () => {
    const yaml = `
provider: test
account: a
version: 2
extra: thing
operations:
  op:
    allow: true
`;
    const { warnings } = parsePolicy(yaml);
    expect(warnings).toContain('Unknown top-level key: "version"');
    expect(warnings).toContain('Unknown top-level key: "extra"');
  });

  it('warns on unknown operation-level keys', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    description: "some note"
    priority: high
`;
    const { warnings } = parsePolicy(yaml);
    expect(warnings.some(w => w.includes('"description"'))).toBe(true);
    expect(warnings.some(w => w.includes('"priority"'))).toBe(true);
  });

  // ── Field policies ──────────────────────────────────────────────────

  it('accepts allowed_fields as string array', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    allowed_fields:
      - calendarId
      - summary
`;
    const { policy, warnings } = parsePolicy(yaml);
    expect(warnings).toHaveLength(0);
    expect(policy.operations.op.allowed_fields).toEqual(['calendarId', 'summary']);
  });

  it('accepts denied_fields as string array', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    denied_fields:
      - attendees
      - conferenceData
`;
    const { policy, warnings } = parsePolicy(yaml);
    expect(warnings).toHaveLength(0);
    expect(policy.operations.op.denied_fields).toEqual(['attendees', 'conferenceData']);
  });

  it('throws when both allowed_fields and denied_fields on same operation', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    allowed_fields:
      - calendarId
    denied_fields:
      - attendees
`;
    expect(() => parsePolicy(yaml)).toThrow('cannot have both allowed_fields and denied_fields');
  });

  it('throws when allowed_fields contains non-string elements', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    allowed_fields:
      - calendarId
      - 123
`;
    expect(() => parsePolicy(yaml)).toThrow('allowed_fields[1] must be a string');
  });

  it('throws when denied_fields contains non-string elements', () => {
    const yaml = `
provider: test
account: a
operations:
  op:
    allow: true
    denied_fields:
      - attendees
      - 456
`;
    expect(() => parsePolicy(yaml)).toThrow('denied_fields[1] must be a string');
  });
});
