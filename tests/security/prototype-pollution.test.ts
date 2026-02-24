/**
 * Security Audit: Prototype Pollution via Field Path
 *
 * Tests for FINDING-05 (FIXED): field-path.ts now rejects
 * __proto__, constructor, and prototype in path segments.
 */
import { describe, it, expect } from 'vitest';
import { getByPath, setByPath, deleteByPath } from '../../src/policy/field-path.js';

describe('FINDING-05: Prototype pollution via field paths (FIXED)', () => {
  describe('setByPath rejects dangerous paths', () => {
    it('throws on __proto__ path', () => {
      const obj: Record<string, unknown> = {};
      expect(() => setByPath(obj, '__proto__.polluted', 'yes')).toThrow('Forbidden field path segment: __proto__');
    });

    it('throws on constructor path', () => {
      const obj: Record<string, unknown> = {};
      expect(() => setByPath(obj, 'constructor.prototype.injected', 'attack')).toThrow('Forbidden field path segment: constructor');
    });

    it('throws on prototype path', () => {
      const obj: Record<string, unknown> = {};
      expect(() => setByPath(obj, 'prototype.polluted', 'yes')).toThrow('Forbidden field path segment: prototype');
    });
  });

  describe('getByPath rejects dangerous paths', () => {
    it('throws on __proto__ path', () => {
      const obj: Record<string, unknown> = {};
      expect(() => getByPath(obj, '__proto__.toString')).toThrow('Forbidden field path segment: __proto__');
    });

    it('throws on constructor path', () => {
      const obj: Record<string, unknown> = {};
      expect(() => getByPath(obj, 'constructor.name')).toThrow('Forbidden field path segment: constructor');
    });
  });

  describe('deleteByPath rejects dangerous paths', () => {
    it('throws on __proto__ path', () => {
      const obj: Record<string, unknown> = {};
      expect(() => deleteByPath(obj, '__proto__.__securityTestProp__')).toThrow('Forbidden field path segment: __proto__');
    });
  });

  describe('Field path edge cases', () => {
    it('handles empty string field path', () => {
      const obj: Record<string, unknown> = { '': 'empty-key' };
      const result = getByPath(obj, '');
      expect(result).toBe('empty-key');
    });

    it('handles deeply nested paths', () => {
      const obj: Record<string, unknown> = {};
      const deepPath = Array(1000).fill('a').join('.');
      setByPath(obj, deepPath, 'deep');

      const result = getByPath(obj, deepPath);
      expect(result).toBe('deep');
    });
  });
});
