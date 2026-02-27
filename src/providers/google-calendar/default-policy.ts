export const defaultPolicyYaml = `provider: google_calendar
account: "{account}"

operations:
  list_calendars:
    allow: true

  list_events:
    allow: true
    # By default, agents can list events from any calendar the Google account
    # has access to (including shared/group calendars). To restrict, uncomment:
    # constraints:
    #   - field: calendarId
    #     rule: must_equal
    #     value: primary

  get_event:
    allow: true

  create_event:
    allow: false
    # To restrict which calendar the agent can create events on, uncomment:
    # constraints:
    #   - field: calendarId
    #     rule: must_equal
    #     value: primary
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
    # To restrict which calendar the agent can update events on, uncomment:
    # constraints:
    #   - field: calendarId
    #     rule: must_equal
    #     value: primary
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
`;
