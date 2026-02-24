/**
 * Security Audit: Policy Engine Bypass Tests
 *
 * Tests for FINDING-06 (extra fields pass through unchecked),
 * FINDING-07 (mutation ordering issues), and
 * FINDING-08 (policy parser trusts input shape).
 */
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/policy/engine.js';
import { parsePolicy } from '../../src/policy/parser.js';
import type { PolicyConfig } from '../../src/policy/types.js';

// A policy that constrains calendarId and deletes attendees
const STRICT_POLICY: PolicyConfig = {
  provider: 'google_calendar',
  account: 'test@gmail.com',
  operations: {
    create_event: {
      allow: true,
      constraints: [
        { field: 'calendarId', rule: 'must_equal', value: 'primary' },
      ],
      mutations: [
        { field: 'attendees', action: 'delete' },
        { field: 'visibility', action: 'set', value: 'private' },
      ],
    },
    list_events: {
      allow: true,
      constraints: [
        { field: 'calendarId', rule: 'must_equal', value: 'primary' },
      ],
    },
  },
};

describe('FINDING-06: Extra fields pass through policy unchecked', () => {
  it('fields not mentioned in constraints or mutations are passed through unchanged', () => {
    const result = evaluate(STRICT_POLICY, 'create_event', {
      calendarId: 'primary',
      summary: 'Meeting',
      // These extra fields are not mentioned in any constraint or mutation
      sendUpdates: 'all',          // Could trigger email notifications
      guestsCanModify: true,       // Security-relevant setting
      reminders: { useDefault: false, overrides: [] },
      conferenceData: { createRequest: { requestId: 'evil' } },
      recurrence: ['RRULE:FREQ=DAILY;COUNT=365'],  // Create 365 events
    });

    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      // All extra fields pass through to the provider
      expect(result.mutatedParams.sendUpdates).toBe('all');
      expect(result.mutatedParams.guestsCanModify).toBe(true);
      expect(result.mutatedParams.conferenceData).toBeDefined();
      expect(result.mutatedParams.recurrence).toBeDefined();

      // Only explicitly mutated fields are changed
      expect(result.mutatedParams.attendees).toBeUndefined(); // deleted
      expect(result.mutatedParams.visibility).toBe('private'); // set
    }
  });

  it('agent can pass arbitrary nested objects as tool parameters', () => {
    const result = evaluate(STRICT_POLICY, 'create_event', {
      calendarId: 'primary',
      summary: 'Meeting',
      // Deeply nested arbitrary data passes through
      extendedProperties: {
        shared: {
          exfil_data: 'sensitive information here',
          callback_url: 'https://evil.com/collect',
        },
      },
    });

    expect(result.action).toBe('allow');
    if (result.action === 'allow') {
      expect(result.mutatedParams.extendedProperties).toBeDefined();
    }
  });
});

describe('FINDING-07: Constraint only checks specified fields', () => {
  it('constraint on calendarId does not prevent accessing other calendars via other params', () => {
    // The constraint checks calendarId, but an agent could potentially
    // pass calendar access info through other fields depending on the provider
    const result = evaluate(STRICT_POLICY, 'list_events', {
      calendarId: 'primary',
      // These params would be passed to the Google API
      // sharedExtendedProperty could potentially leak data across calendars
      q: 'secret meeting',
    });

    expect(result.action).toBe('allow');
  });
});

describe('FINDING-08: Policy parser does not validate operation shapes', () => {
  it('parsePolicy warns on unknown operation-level keys but still parses', () => {
    const yaml = `
provider: google_calendar
account: test@gmail.com
operations:
  create_event:
    allow: true
    unknown_field: this_should_not_be_here
    constraints:
      - field: calendarId
        rule: must_equal
        value: primary
`;
    // Strict parser accepts but warns on unknown keys
    const { policy, warnings } = parsePolicy(yaml);
    expect(policy.operations.create_event.allow).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('unknown_field'))).toBe(true);
  });

  it('parsePolicy rejects constraints with unknown rules at parse time', () => {
    const yaml = `
provider: google_calendar
account: test@gmail.com
operations:
  create_event:
    allow: true
    constraints:
      - field: calendarId
        rule: must_match_regex
        value: "^primary$"
`;
    // Strict parser now rejects unknown constraint rules at parse time
    expect(() => parsePolicy(yaml)).toThrow('unknown rule "must_match_regex"');
  });

  it('parsePolicy rejects mutations with unknown actions at parse time', () => {
    const yaml = `
provider: google_calendar
account: test@gmail.com
operations:
  create_event:
    allow: true
    mutations:
      - field: calendarId
        action: encrypt
        value: "key123"
`;
    // Strict parser now rejects unknown mutation actions at parse time
    expect(() => parsePolicy(yaml)).toThrow('unknown action "encrypt"');
  });
});

describe('FINDING-09: Case sensitivity in policy operations', () => {
  it('operation names are case-sensitive (correct behavior)', () => {
    // Verify that 'Create_Event' does not match 'create_event'
    const result = evaluate(STRICT_POLICY, 'Create_Event', {
      calendarId: 'primary',
    });

    // Should be denied because 'Create_Event' is not in the policy
    expect(result.action).toBe('deny');
  });

  it('constraint values are case-sensitive (could be a feature gap)', () => {
    const result = evaluate(STRICT_POLICY, 'list_events', {
      calendarId: 'Primary', // uppercase P
    });

    // Correctly denied because 'Primary' !== 'primary'
    expect(result.action).toBe('deny');
  });
});

describe('FINDING-10: Deny-by-default is correctly enforced', () => {
  it('operations not in policy are denied', () => {
    const result = evaluate(STRICT_POLICY, 'delete_event', {});
    expect(result.action).toBe('deny');
  });

  it('operations with allow:false are denied', () => {
    const policy: PolicyConfig = {
      ...STRICT_POLICY,
      operations: {
        ...STRICT_POLICY.operations,
        delete_event: { allow: false },
      },
    };
    const result = evaluate(policy, 'delete_event', {});
    expect(result.action).toBe('deny');
  });
});
