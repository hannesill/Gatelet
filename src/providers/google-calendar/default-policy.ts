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
    allow: false
    mutations:
      - field: attendees
        action: delete
      - field: visibility
        action: delete
      - field: guestsCanModify
        action: delete
      - field: guestsCanInviteOthers
        action: delete
`;
