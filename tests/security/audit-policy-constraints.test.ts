/**
 * Security Audit: Policy engine constraint bypasses
 *
 * Tests for must_match regex bypasses, must_equal type coercion,
 * must_be_one_of, and must_not_be_empty edge cases.
 */
import { describe, it, expect } from 'vitest';
import { evaluateConstraint, isSafeRegex } from '../../src/policy/constraints.js';
import { evaluate } from '../../src/policy/engine.js';
import { parsePolicy } from '../../src/policy/parser.js';
import type { Constraint } from '../../src/policy/types.js';

describe('Policy Engine: must_match regex bypass vectors', () => {
  // FINDING-NEW-01: must_match regex is not anchored
  it('FINDING-NEW-01: unanchored must_match allows partial match bypass', () => {
    const constraint: Constraint = {
      field: 'from',
      rule: 'must_match',
      value: '\\+agent@',
    };
    const params = { from: 'evil@attacker.com, user+agent@domain.com' };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(true);
  });

  it('FINDING-NEW-01: anchored regex properly blocks injection', () => {
    const constraint: Constraint = {
      field: 'from',
      rule: 'must_match',
      value: '^[^@]+\\+agent@[^@]+$',
    };
    const params = { from: 'evil@attacker.com, user+agent@domain.com' };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(false);
  });

  // FINDING-NEW-02: must_match on non-string types
  it('FINDING-NEW-02: must_match on number converts via JSON.stringify', () => {
    const constraint: Constraint = {
      field: 'count',
      rule: 'must_match',
      value: '^\\d+$',
    };
    const paramsNum = { count: 42 };
    const resultNum = evaluateConstraint(constraint, paramsNum);
    expect(resultNum.ok).toBe(true);

    const constraintBool: Constraint = {
      field: 'flag',
      rule: 'must_match',
      value: '^true$',
    };
    const paramsBool = { flag: true };
    const resultBool = evaluateConstraint(constraintBool, paramsBool);
    expect(resultBool.ok).toBe(true);
  });

  it('FINDING-NEW-02: must_match on array produces unexpected JSON', () => {
    const constraint: Constraint = {
      field: 'items',
      rule: 'must_match',
      value: '^[a-z,]+$',
    };
    const params = { items: ['a', 'b'] };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(false);
  });

  it('FINDING-NEW-02: must_match on object could leak prototype info', () => {
    const constraint: Constraint = {
      field: 'data',
      rule: 'must_match',
      value: '.',
    };
    const params = { data: { key: 'value' } };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(true);
  });

  // FINDING-NEW-03: ReDoS — now fixed by isSafeRegex
  it('FINDING-NEW-03: catastrophic regex in policy YAML is rejected at parse time', () => {
    const yamlWithBadRegex = `
provider: google_calendar
account: test@gmail.com
operations:
  create_event:
    allow: true
    constraints:
      - field: summary
        rule: must_match
        value: "^(a+)+b$"
`;
    expect(() => parsePolicy(yamlWithBadRegex)).toThrow('unsafe regex');
  });

  it('FINDING-NEW-03: unsafe regex rejected at runtime as defense-in-depth', () => {
    const constraint: Constraint = {
      field: 'summary',
      rule: 'must_match',
      value: '^(a+)+b$',
    };
    const result = evaluateConstraint(constraint, { summary: 'test' });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('unsafe regex');
  });
});

describe('isSafeRegex', () => {
  it('rejects nested quantifier patterns', () => {
    expect(isSafeRegex('(a+)+b')).toBe(false);
    expect(isSafeRegex('(a*)*')).toBe(false);
    expect(isSafeRegex('(x+x+)+y')).toBe(false);
    expect(isSafeRegex('(a+)+')).toBe(false);
    expect(isSafeRegex('([a-z]+)+')).toBe(false);
    expect(isSafeRegex('(a{2,})+')).toBe(false);
  });

  it('allows safe patterns', () => {
    expect(isSafeRegex('^[a-z]+$')).toBe(true);
    expect(isSafeRegex('\\d{1,3}\\.\\d{1,3}')).toBe(true);
    expect(isSafeRegex('^\\+agent@')).toBe(true);
    expect(isSafeRegex('.')).toBe(true);
    expect(isSafeRegex('^[^@]+\\+agent@[^@]+$')).toBe(true);
  });
});

describe('Policy Engine: must_equal type coercion vectors', () => {
  // FINDING-NEW-04: must_equal uses strict equality
  it('must_equal with string "10" does not match number 10', () => {
    const constraint: Constraint = {
      field: 'maxResults',
      rule: 'must_equal',
      value: '10',
    };
    const params = { maxResults: 10 };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(false);
  });

  it('must_equal rejects null when value is empty string', () => {
    const constraint: Constraint = {
      field: 'name',
      rule: 'must_equal',
      value: '',
    };
    const params = { name: null };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(false);
  });

  it('must_equal rejects undefined field (missing param)', () => {
    const constraint: Constraint = {
      field: 'name',
      rule: 'must_equal',
      value: undefined,
    };
    const params = {};
    const result = evaluateConstraint(constraint, params);
    // FINDING-NEW-05: undefined === undefined is true
    expect(result.ok).toBe(true);
  });
});

describe('Policy Engine: must_be_one_of edge cases', () => {
  it('must_be_one_of rejects NaN (not in array)', () => {
    const constraint: Constraint = {
      field: 'priority',
      rule: 'must_be_one_of',
      value: [1, 2, 3],
    };
    const params = { priority: NaN };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(false);
  });

  it('must_be_one_of allows null if null is in the allowed list', () => {
    const constraint: Constraint = {
      field: 'status',
      rule: 'must_be_one_of',
      value: ['active', 'paused', null],
    };
    const params = { status: null };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(true);
  });
});

describe('Policy Engine: must_not_be_empty edge cases', () => {
  it('must_not_be_empty rejects whitespace-only string', () => {
    const constraint: Constraint = {
      field: 'to',
      rule: 'must_not_be_empty',
    };
    const params = { to: '   ' };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(false);
  });

  it('must_not_be_empty passes for object', () => {
    const constraint: Constraint = {
      field: 'data',
      rule: 'must_not_be_empty',
    };
    const params = { data: {} };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(true);
  });

  it('must_not_be_empty passes for number 0', () => {
    const constraint: Constraint = {
      field: 'count',
      rule: 'must_not_be_empty',
    };
    const params = { count: 0 };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(true);
  });

  it('must_not_be_empty passes for false', () => {
    const constraint: Constraint = {
      field: 'flag',
      rule: 'must_not_be_empty',
    };
    const params = { flag: false };
    const result = evaluateConstraint(constraint, params);
    expect(result.ok).toBe(true);
  });
});
