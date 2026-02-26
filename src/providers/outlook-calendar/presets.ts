import { defaultPolicyYaml } from './default-policy.js';

export const presets: Record<string, string> = {
  'read-only': `provider: outlook_calendar
account: "{account}"

operations:
  list_calendars:
    allow: true

  list_events:
    allow: true

  get_event:
    allow: true
`,

  'standard': defaultPolicyYaml,

  'full-access': `provider: outlook_calendar
account: "{account}"

operations:
  list_calendars:
    allow: true

  list_events:
    allow: true

  get_event:
    allow: true

  create_event:
    allow: true

  update_event:
    allow: true
`,
};
