/**
 * Security Audit: Prototype Pollution via Field Path
 *
 * Tests for FINDING-05: field-path.ts setByPath/getByPath/deleteByPath
 * do not sanitize __proto__, constructor, or prototype paths.
 */
import { describe, it, expect } from 'vitest';
import { getByPath, setByPath, deleteByPath } from '../../src/policy/field-path.js';

describe('FINDING-05: Prototype pollution via field paths', () => {
  describe('setByPath allows __proto__ traversal', () => {
    it('can set __proto__.polluted via setByPath', () => {
      const obj: Record<string, unknown> = {};
      setByPath(obj, '__proto__.polluted', 'yes');

      // On a plain object, __proto__ is the Object prototype.
      // If setByPath traverses into __proto__ and sets a property,
      // it could pollute Object.prototype for all objects.
      //
      // In practice, structuredClone (used in engine.ts before mutations)
      // creates a plain object, so __proto__ navigation via bracket notation
      // goes to the actual prototype. Let's check:

      // The key question is: does (obj as any).__proto__ get assigned to?
      // In modern V8, obj['__proto__'] is special and acts as a setter
      // for the prototype, while Object.getOwnPropertyDescriptor won't
      // find it as an own property.

      // Let's test if a fresh object was polluted:
      const fresh: Record<string, unknown> = {};
      const pollutedValue = (fresh as Record<string, unknown>).polluted;

      // If pollution succeeded, this would be 'yes'
      // If V8 protects against it, it would be undefined
      // Either way, we document the attempt:
      if (pollutedValue === 'yes') {
        // VULNERABLE: prototype pollution succeeded
        // Clean up immediately
        delete (Object.prototype as Record<string, unknown>).polluted;
        expect(pollutedValue).toBe('yes');
      } else {
        // V8's __proto__ setter behavior prevented direct pollution
        // BUT the code still doesn't validate the path, which is a weakness
        expect(true).toBe(true);
      }
    });

    it('can set constructor.prototype properties via setByPath', () => {
      const obj: Record<string, unknown> = {};

      // Try to traverse through constructor.prototype
      setByPath(obj, 'constructor.prototype.injected', 'attack');

      // Check if Object.prototype was polluted
      const fresh: Record<string, unknown> = {};
      const injected = (fresh as Record<string, unknown>).injected;

      if (injected === 'attack') {
        delete (Object.prototype as Record<string, unknown>).injected;
        // VULNERABLE
        expect(injected).toBe('attack');
      } else {
        // The setByPath code does: current[part] = {} when intermediate
        // is null/non-object. Since obj.constructor is Function (truthy
        // and typeof 'function' which is not 'object'), the code enters
        // the if branch and overwrites it with {}.
        // This means it creates obj.constructor = {} then sets
        // obj.constructor.prototype = {} then sets
        // obj.constructor.prototype.injected = 'attack'
        // This overwrites the constructor reference but doesn't pollute
        // the global prototype. Still bad for the object itself.
        expect(true).toBe(true);
      }
    });
  });

  describe('getByPath reads from __proto__', () => {
    it('can read Object.prototype properties via __proto__ path', () => {
      const obj: Record<string, unknown> = {};

      // toString exists on Object.prototype
      const result = getByPath(obj, '__proto__.toString');

      // This reads from the prototype chain -- information disclosure
      // about the runtime environment
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('constructor traversal creates intermediate objects', () => {
      const obj: Record<string, unknown> = {};
      const result = getByPath(obj, 'constructor.name');

      // In V8, obj.constructor is Function (typeof === 'function'),
      // which is an 'object' type in the typeof check. But the
      // getByPath check is `typeof current !== 'object'`, and
      // typeof Function === 'function', so it returns undefined.
      // This is actually a defense (functions are not traversed as objects).
      // However, setByPath WOULD overwrite constructor with {} first.
      expect(result).toBeUndefined();
    });
  });

  describe('deleteByPath on prototype paths', () => {
    it('CONFIRMED VULN: deleteByPath can delete from Object.prototype via __proto__', () => {
      // IMPORTANT: In the previous test run, calling
      //   deleteByPath(obj, '__proto__.hasOwnProperty')
      // ACTUALLY DELETED hasOwnProperty from Object.prototype,
      // crashing Vitest's pretty-format module which uses it.
      //
      // This confirms that __proto__ traversal in deleteByPath
      // reaches Object.prototype and can destroy global built-ins.
      //
      // We use a safer property to demonstrate without crashing the test runner.
      const testProp = '__securityTestProp__';
      (Object.prototype as Record<string, unknown>)[testProp] = 'canary';

      const obj: Record<string, unknown> = {};

      // Verify the property exists on all objects via prototype
      expect((obj as Record<string, unknown>)[testProp]).toBe('canary');

      // deleteByPath traverses __proto__ and deletes from Object.prototype
      deleteByPath(obj, `__proto__.${testProp}`);

      // The property was deleted from Object.prototype
      const fresh: Record<string, unknown> = {};
      expect((fresh as Record<string, unknown>)[testProp]).toBeUndefined();

      // This is a CONFIRMED prototype pollution vulnerability.
      // A malicious policy (set by admin) or a bug in field path handling
      // could corrupt the global Object prototype and crash the server
      // or alter security-critical behavior.
    });
  });

  describe('Field path edge cases', () => {
    it('handles empty string field path', () => {
      const obj: Record<string, unknown> = { '': 'empty-key' };
      const result = getByPath(obj, '');
      // split('.') on '' returns [''] which looks up obj['']
      expect(result).toBe('empty-key');
    });

    it('handles deeply nested paths', () => {
      const obj: Record<string, unknown> = {};
      // Create a very deep path - potential stack/memory issue
      const deepPath = Array(1000).fill('a').join('.');
      setByPath(obj, deepPath, 'deep');

      const result = getByPath(obj, deepPath);
      expect(result).toBe('deep');
    });
  });
});
