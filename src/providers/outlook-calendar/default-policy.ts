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
    # To restrict which calendar the agent can create events on, uncomment:
    # constraints:
    #   - field: calendarId
    #     rule: must_equal
    #     value: "YOUR_CALENDAR_ID"

  update_event:
    allow: false
    # To restrict which calendar the agent can update events on, uncomment:
    # constraints:
    #   - field: calendarId
    #     rule: must_equal
    #     value: "YOUR_CALENDAR_ID"
`;
