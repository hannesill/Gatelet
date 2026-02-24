export const defaultPolicyYaml = `provider: outlook_calendar
account: "{account}"

operations:
  list_calendars:
    allow: true

  list_events:
    allow: true

  get_event:
    allow: true

  create_event:
    allow: false

  update_event:
    allow: false
`;
