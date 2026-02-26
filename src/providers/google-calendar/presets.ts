import { defaultPolicyYaml } from './default-policy.js';

export const presets: Record<string, string> = {
  'read-only': `provider: google_calendar
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

  'full-access': `provider: google_calendar
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
    mutations:
      - field: attendees
        action: delete
      - field: visibility
        action: set
        value: default
      - field: guestsCanModify
        action: delete
      - field: guestsCanInviteOthers
        action: delete

  update_event:
    allow: true
    guards:
      require_organizer_self: true
    mutations:
      - field: attendees
        action: delete
      - field: visibility
        action: delete
      - field: guestsCanModify
        action: delete
      - field: guestsCanInviteOthers
        action: delete
`,
};
