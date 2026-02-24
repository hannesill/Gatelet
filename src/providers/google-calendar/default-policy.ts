export const defaultPolicyYaml = `provider: google_calendar
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
