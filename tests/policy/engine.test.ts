import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/policy/engine.js';
import type { PolicyConfig } from '../../src/policy/types.js';

const basePolicy: PolicyConfig = {
  provider: 'google_calendar',
  account: 'test@gmail.com',
  operations: {
    list_calendars: { allow: true },
    list_events: { allow: true },
    create_event: {
      allow: true,
      constraints: [
        { field: 'calendarId', rule: 'must_equal', value: 'my_cal' },
      ],
      mutations: [
        { field: 'attendees', action: 'set', value: [] },
        { field: 'visibility', action: 'set', value: 'private' },
      ],
    },
    denied_op: { allow: false },
  },
};

describe('policy engine', () => {
  it('denies operation not in policy', () => {
    const result = evaluate(basePolicy, 'delete_event', {});
    expect(result.action).toBe('deny');
    if (result.action === 'deny') {
      expect(result.reason).toContain('not configured');
    }
  });

  it('denies explicitly denied operation', () => {
    const result = evaluate(basePolicy, 'denied_op', {});
    expect(result.action).toBe('deny');
    if (result.action === 'deny') {
      expect(result.reason).toContain('explicitly denied');
    }
  });

  it('allows operation with no constraints, params unchanged', () => {
    const params = { some: 'value' };
    const result = evaluate(basePolicy, 'list_calendars', params);
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.mutatedParams).toEqual({ some: 'value' });
    }
  });

  it('allows with passing constraints', () => {
    const result = evaluate(basePolicy, 'create_event', {
      calendarId: 'my_cal',
      summary: 'Test',
    });
    expect(result.action).toBe('allow');
  });

  it('denies with failing constraint', () => {
    const result = evaluate(basePolicy, 'create_event', {
      calendarId: 'wrong_cal',
      summary: 'Test',
    });
    expect(result.action).toBe('deny');
    if (result.action === 'deny') {
      expect(result.reason).toContain('must_equal');
      expect(result.reason).toContain('"my_cal"');
      expect(result.reason).toContain('"wrong_cal"');
    }
  });

  it('applies mutations to allowed call', () => {
    const result = evaluate(basePolicy, 'create_event', {
      calendarId: 'my_cal',
      summary: 'Test',
      attendees: [{ email: 'someone@example.com' }],
      visibility: 'public',
    });
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.mutatedParams.attendees).toEqual([]);
      expect(result.mutatedParams.visibility).toBe('private');
      expect(result.mutatedParams.summary).toBe('Test');
    }
  });

  it('checks constraints before applying mutations', () => {
    // If constraint fails, mutations should NOT be applied
    const result = evaluate(basePolicy, 'create_event', {
      calendarId: 'wrong',
      attendees: [{ email: 'someone@example.com' }],
    });
    expect(result.action).toBe('deny');
  });

  it('handles multiple constraints — all must pass', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        op: {
          allow: true,
          constraints: [
            { field: 'a', rule: 'must_equal', value: 1 },
            { field: 'b', rule: 'must_equal', value: 2 },
          ],
        },
      },
    };

    const fail = evaluate(policy, 'op', { a: 1, b: 999 });
    expect(fail.action).toBe('deny');

    const pass = evaluate(policy, 'op', { a: 1, b: 2 });
    expect(pass.action).toBe('allow');
  });

  it('applies multiple mutations in order', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        op: {
          allow: true,
          mutations: [
            { field: 'x', action: 'set', value: 'first' },
            { field: 'x', action: 'set', value: 'second' },
          ],
        },
      },
    };

    const result = evaluate(policy, 'op', {});
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.mutatedParams.x).toBe('second');
    }
  });

  it('passes guards through in allow result', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        op: {
          allow: true,
          guards: { require_organizer_self: true },
        },
      },
    };

    const result = evaluate(policy, 'op', { foo: 'bar' });
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.guards).toEqual({ require_organizer_self: true });
    }
  });

  it('returns undefined guards when none configured', () => {
    const result = evaluate(basePolicy, 'list_calendars', {});
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.guards).toBeUndefined();
    }
  });

  it('handles empty params object', () => {
    const result = evaluate(basePolicy, 'list_events', {});
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.mutatedParams).toEqual({});
    }
  });

  it('does not modify original params (deep clone)', () => {
    const originalParams = {
      calendarId: 'my_cal',
      attendees: [{ email: 'test@test.com' }],
      visibility: 'public',
    };
    const paramsCopy = structuredClone(originalParams);

    const result = evaluate(basePolicy, 'create_event', originalParams);
    expect(result.action).toBe('allow');

    // Original should be unchanged
    expect(originalParams).toEqual(paramsCopy);

    // Mutated should be different
    if (result.action === 'allow') {
      expect(result.mutatedParams.attendees).toEqual([]);
      expect(result.mutatedParams.visibility).toBe('private');
    }
  });

  it('includes fieldPolicy with allowed_fields when set', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        op: {
          allow: true,
          allowed_fields: ['calendarId', 'summary'],
        },
      },
    };

    const result = evaluate(policy, 'op', { calendarId: 'cal' });
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.fieldPolicy).toEqual({ allowed_fields: ['calendarId', 'summary'], denied_fields: undefined });
    }
  });

  it('includes fieldPolicy with denied_fields when set', () => {
    const policy: PolicyConfig = {
      provider: 'test',
      account: 'test',
      operations: {
        op: {
          allow: true,
          denied_fields: ['attendees', 'conferenceData'],
        },
      },
    };

    const result = evaluate(policy, 'op', { foo: 'bar' });
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.fieldPolicy).toEqual({ allowed_fields: undefined, denied_fields: ['attendees', 'conferenceData'] });
    }
  });

  it('fieldPolicy is undefined when neither allowed_fields nor denied_fields set', () => {
    const result = evaluate(basePolicy, 'list_calendars', {});
    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.fieldPolicy).toBeUndefined();
    }
  });
});
