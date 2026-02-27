export const defaultPolicyYaml = `provider: outlook_calendar
account: "{account}"

operations:
  list_calendars:
    allow: true

  list_events:
    allow: true
    # By default, agents can list events from any calendar the Microsoft account
    # has access to (including shared calendars). To restrict, uncomment:
    # constraints:
    #   - field: calendarId
    #     rule: must_equal
    #     value: "YOUR_CALENDAR_ID"

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
