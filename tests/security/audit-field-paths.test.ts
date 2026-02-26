/**
 * Security Audit: Field-path edge cases
 *
 * Tests for empty segments, numeric keys, setByPath, deleteByPath.
 */
import { describe, it, expect } from 'vitest';
import { getByPath, setByPath, deleteByPath } from '../../src/policy/field-path.js';

describe('Field-path advanced edge cases', () => {
  it('empty string as path segment (split on ".") accesses "" key', () => {
    const obj: Record<string, unknown> = { '': { '': 'nested-empty' } };
    const result = getByPath(obj, '.');
    expect(result).toBe('nested-empty');
  });

  it('numeric-looking path segments work as object keys (not array indices)', () => {
    const obj: Record<string, unknown> = { '0': 'zero', '1': 'one' };
    expect(getByPath(obj, '0')).toBe('zero');
  });

  it('setByPath creates intermediate objects for missing path segments', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'a.b.c', 'deep');
    expect(getByPath(obj, 'a.b.c')).toBe('deep');
  });

  it('deleteByPath on non-existent path is a no-op', () => {
    const obj: Record<string, unknown> = { a: 1 };
    deleteByPath(obj, 'x.y.z');
    expect(obj).toEqual({ a: 1 });
  });

  it('path with toString/valueOf is allowed (not in DANGEROUS_KEYS)', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'toString', 'overwritten');
    expect(getByPath(obj, 'toString')).toBe('overwritten');
  });
});
