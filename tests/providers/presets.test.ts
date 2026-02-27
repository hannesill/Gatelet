import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { presets as gmailPresets } from '../../src/providers/gmail/presets.js';
import { presets as calendarPresets } from '../../src/providers/google-calendar/presets.js';
import { presets as outlookPresets } from '../../src/providers/outlook-calendar/presets.js';
import { presets as outlookMailPresets } from '../../src/providers/outlook-mail/presets.js';
import { defaultPolicyYaml as gmailDefault } from '../../src/providers/gmail/default-policy.js';
import { defaultPolicyYaml as calendarDefault } from '../../src/providers/google-calendar/default-policy.js';
import { defaultPolicyYaml as outlookDefault } from '../../src/providers/outlook-calendar/default-policy.js';
import { defaultPolicyYaml as outlookMailDefault } from '../../src/providers/outlook-mail/default-policy.js';

const PRESET_KEYS = ['read-only', 'standard', 'full-access'];

const READ_OPS_GMAIL = ['search', 'read_message', 'list_drafts', 'list_labels'];
const WRITE_OPS_GMAIL = ['create_draft', 'send', 'reply', 'label', 'archive', 'move'];

const READ_OPS_OUTLOOK_MAIL = ['search', 'read_message', 'list_drafts', 'list_folders'];
const WRITE_OPS_OUTLOOK_MAIL = ['create_draft', 'send', 'reply', 'categorize', 'archive', 'move', 'flag'];

const READ_OPS_CALENDAR = ['list_calendars', 'list_events', 'get_event'];
const WRITE_OPS_CALENDAR = ['create_event', 'update_event'];

interface ParsedPolicy {
  provider: string;
  account: string;
  operations: Record<string, { allow: boolean; [key: string]: unknown }>;
}

function parsePreset(yaml: string): ParsedPolicy {
  return parse(yaml) as ParsedPolicy;
}

describe.each([
  { name: 'Gmail', presets: gmailPresets, defaultYaml: gmailDefault, provider: 'google_gmail', readOps: READ_OPS_GMAIL, writeOps: WRITE_OPS_GMAIL },
  { name: 'Google Calendar', presets: calendarPresets, defaultYaml: calendarDefault, provider: 'google_calendar', readOps: READ_OPS_CALENDAR, writeOps: WRITE_OPS_CALENDAR },
  { name: 'Outlook Calendar', presets: outlookPresets, defaultYaml: outlookDefault, provider: 'outlook_calendar', readOps: READ_OPS_CALENDAR, writeOps: WRITE_OPS_CALENDAR },
  { name: 'Outlook Mail', presets: outlookMailPresets, defaultYaml: outlookMailDefault, provider: 'outlook_mail', readOps: READ_OPS_OUTLOOK_MAIL, writeOps: WRITE_OPS_OUTLOOK_MAIL },
])('$name presets', ({ presets, defaultYaml, provider, readOps, writeOps }) => {
  it('has all three preset keys', () => {
    expect(Object.keys(presets).sort()).toEqual(PRESET_KEYS.sort());
  });

  it.each(PRESET_KEYS)('%s parses as valid YAML with correct provider and account placeholder', (key) => {
    const parsed = parsePreset(presets[key]);
    expect(parsed.provider).toBe(provider);
    expect(parsed.account).toBe('{account}');
    expect(parsed.operations).toBeDefined();
    expect(typeof parsed.operations).toBe('object');
  });

  it('standard preset is the default policy', () => {
    expect(presets['standard']).toBe(defaultYaml);
  });

  it('read-only has only read operations, all allowed', () => {
    const parsed = parsePreset(presets['read-only']);
    const opNames = Object.keys(parsed.operations);

    // All listed ops should be read-only ops
    for (const op of opNames) {
      expect(readOps).toContain(op);
      expect(parsed.operations[op].allow).toBe(true);
    }

    // No write ops should be present
    for (const op of writeOps) {
      expect(opNames).not.toContain(op);
    }
  });

  it('full-access has all operations enabled', () => {
    const parsed = parsePreset(presets['full-access']);
    const allOps = [...readOps, ...writeOps];

    for (const op of allOps) {
      expect(parsed.operations[op]).toBeDefined();
      expect(parsed.operations[op].allow).toBe(true);
    }
  });
});
