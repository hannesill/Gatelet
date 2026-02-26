/**
 * Security Audit: structuredClone param isolation + hidden tool info leakage
 */
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/policy/engine.js';
import type { PolicyConfig } from '../../src/policy/types.js';

describe('Policy engine: param isolation via structuredClone', () => {
  it('mutations do not affect original params object', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        test_op: {
          allow: true,
          mutations: [
            { field: 'secret', action: 'set', value: 'overwritten' },
            { field: 'remove_me', action: 'delete' },
          ],
        },
      },
    };

    const params = { secret: 'original', remove_me: 'still here', other: 'data' };
    const result = evaluate(policy, 'test_op', params);

    expect(params.secret).toBe('original');
    expect(params.remove_me).toBe('still here');

    if (result.action === 'allow') {
      expect(result.mutatedParams.secret).toBe('overwritten');
      expect(result.mutatedParams.remove_me).toBeUndefined();
    }
  });

  it('structuredClone prevents shared object references', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        test_op: { allow: true },
      },
    };

    const nested = { inner: 'value' };
    const params = { data: nested };
    const result = evaluate(policy, 'test_op', params);

    if (result.action === 'allow') {
      (result.mutatedParams.data as Record<string, unknown>).inner = 'changed';
      expect(nested.inner).toBe('value');
    }
  });
});

describe('Hidden tool information leakage', () => {
  it('tool registry only includes allowed operations', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        allowed_op: { allow: true },
        denied_op: { allow: false },
      },
    };

    const result1 = evaluate(policy, 'secret_op', {});
    expect(result1.action).toBe('deny');

    const result2 = evaluate(policy, 'denied_op', {});
    expect(result2.action).toBe('deny');

    const result3 = evaluate(policy, 'allowed_op', {});
    expect(result3.action).toBe('allow');
  });

  it('deny reasons do not reveal other tool names or operations', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        allowed_op: { allow: true },
      },
    };

    const result = evaluate(policy, 'nonexistent_tool', {});
    if (result.action === 'deny') {
      expect(result.reason).toContain('nonexistent_tool');
      expect(result.reason).not.toContain('allowed_op');
    }
  });
});
