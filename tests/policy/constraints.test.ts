import { describe, it, expect } from 'vitest';
import { evaluateConstraint } from '../../src/policy/constraints.js';

describe('must_equal', () => {
  it('passes when values match', () => {
    const result = evaluateConstraint(
      { field: 'calendarId', rule: 'must_equal', value: 'abc123' },
      { calendarId: 'abc123' },
    );
    expect(result.ok).toBe(true);
  });

  it('fails when values mismatch', () => {
    const result = evaluateConstraint(
      { field: 'calendarId', rule: 'must_equal', value: 'abc123' },
      { calendarId: 'other' },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('must_equal');
    expect(result.reason).toContain('"abc123"');
    expect(result.reason).toContain('"other"');
  });

  it('fails when field is missing', () => {
    const result = evaluateConstraint(
      { field: 'calendarId', rule: 'must_equal', value: 'abc123' },
      {},
    );
    expect(result.ok).toBe(false);
  });

  it('fails when field is null', () => {
    const result = evaluateConstraint(
      { field: 'calendarId', rule: 'must_equal', value: 'abc123' },
      { calendarId: null },
    );
    expect(result.ok).toBe(false);
  });

  it('handles boolean values', () => {
    const result = evaluateConstraint(
      { field: 'active', rule: 'must_equal', value: true },
      { active: true },
    );
    expect(result.ok).toBe(true);
  });

  it('handles number values', () => {
    const result = evaluateConstraint(
      { field: 'count', rule: 'must_equal', value: 5 },
      { count: 5 },
    );
    expect(result.ok).toBe(true);
  });
});

describe('must_be_one_of', () => {
  it('passes when value is in list', () => {
    const result = evaluateConstraint(
      { field: 'visibility', rule: 'must_be_one_of', value: ['public', 'private'] },
      { visibility: 'private' },
    );
    expect(result.ok).toBe(true);
  });

  it('fails when value is not in list', () => {
    const result = evaluateConstraint(
      { field: 'visibility', rule: 'must_be_one_of', value: ['public', 'private'] },
      { visibility: 'default' },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('must_be_one_of');
  });

  it('fails with empty allowed array', () => {
    const result = evaluateConstraint(
      { field: 'visibility', rule: 'must_be_one_of', value: [] },
      { visibility: 'anything' },
    );
    expect(result.ok).toBe(false);
  });
});

describe('must_not_be_empty', () => {
  it('passes for non-empty string', () => {
    const result = evaluateConstraint(
      { field: 'summary', rule: 'must_not_be_empty' },
      { summary: 'Meeting' },
    );
    expect(result.ok).toBe(true);
  });

  it('passes for non-empty array', () => {
    const result = evaluateConstraint(
      { field: 'items', rule: 'must_not_be_empty' },
      { items: ['a'] },
    );
    expect(result.ok).toBe(true);
  });

  it('fails for null', () => {
    const result = evaluateConstraint(
      { field: 'summary', rule: 'must_not_be_empty' },
      { summary: null },
    );
    expect(result.ok).toBe(false);
  });

  it('fails for undefined (missing field)', () => {
    const result = evaluateConstraint(
      { field: 'summary', rule: 'must_not_be_empty' },
      {},
    );
    expect(result.ok).toBe(false);
  });

  it('fails for empty string', () => {
    const result = evaluateConstraint(
      { field: 'summary', rule: 'must_not_be_empty' },
      { summary: '' },
    );
    expect(result.ok).toBe(false);
  });

  it('fails for empty array', () => {
    const result = evaluateConstraint(
      { field: 'items', rule: 'must_not_be_empty' },
      { items: [] },
    );
    expect(result.ok).toBe(false);
  });
});

describe('must_match', () => {
  it('passes when string matches regex', () => {
    const result = evaluateConstraint(
      { field: 'from', rule: 'must_match', value: '^user\\+.*@example\\.com$' },
      { from: 'user+agent@example.com' },
    );
    expect(result.ok).toBe(true);
  });

  it('fails when string does not match regex', () => {
    const result = evaluateConstraint(
      { field: 'from', rule: 'must_match', value: '^user\\+.*@example\\.com$' },
      { from: 'other@example.com' },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('must_match');
  });

  it('coerces non-string values to JSON', () => {
    const result = evaluateConstraint(
      { field: 'count', rule: 'must_match', value: '42' },
      { count: 42 },
    );
    expect(result.ok).toBe(true);
  });

  it('fails for null or undefined actual value', () => {
    const resultNull = evaluateConstraint(
      { field: 'x', rule: 'must_match', value: '.*' },
      { x: null },
    );
    expect(resultNull.ok).toBe(false);

    const resultUndefined = evaluateConstraint(
      { field: 'x', rule: 'must_match', value: '.*' },
      {},
    );
    expect(resultUndefined.ok).toBe(false);
  });

  it('throws for invalid regex (validation happens at parse time)', () => {
    // Invalid regexes are caught at policy parse time, not at evaluation time.
    // If one somehow reaches evaluateConstraint, it throws a SyntaxError.
    expect(() => evaluateConstraint(
      { field: 'x', rule: 'must_match', value: '[invalid(' },
      { x: 'test' },
    )).toThrow(SyntaxError);
  });
});

describe('nested field access', () => {
  it('evaluates constraints on nested fields', () => {
    const result = evaluateConstraint(
      { field: 'location.displayName', rule: 'must_equal', value: 'Office' },
      { location: { displayName: 'Office' } },
    );
    expect(result.ok).toBe(true);
  });

  it('fails when intermediate path is missing', () => {
    const result = evaluateConstraint(
      { field: 'location.displayName', rule: 'must_equal', value: 'Office' },
      {},
    );
    expect(result.ok).toBe(false);
  });
});
