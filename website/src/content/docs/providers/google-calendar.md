---
title: Google Calendar
description: Google Calendar provider — tools, parameters, and default policy
---

The Google Calendar provider connects to the Google Calendar API via OAuth2 using the `googleapis` library.

## Tools

### `calendar_list_calendars`

List all calendars accessible to the connected Google account.

**Policy operation:** `list_calendars`

**Parameters:** None

---

### `calendar_list_events`

List events from a specific calendar.

**Policy operation:** `list_events`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `calendarId` | string | yes | Calendar ID (e.g. `"primary"`) |
| `timeMin` | string | no | ISO 8601 datetime lower bound |
| `timeMax` | string | no | ISO 8601 datetime upper bound |
| `q` | string | no | Free text search query |
| `maxResults` | number | no | Max events to return (default 50) |

---

### `calendar_get_event`

Get details of a specific calendar event.

**Policy operation:** `get_event`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `calendarId` | string | yes | Calendar ID |
| `eventId` | string | yes | Event ID |

---

### `calendar_create_event`

Create a new calendar event.

**Policy operation:** `create_event`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `calendarId` | string | yes | Calendar ID |
| `summary` | string | yes | Event title |
| `description` | string | no | Event description |
| `location` | string | no | Event location |
| `start` | object | yes | `{ dateTime: string, timeZone?: string }` |
| `end` | object | yes | `{ dateTime: string, timeZone?: string }` |
| `attendees` | array | no | `[{ email: string }]` |
| `visibility` | string | no | `"default"`, `"public"`, or `"private"` |
| `guestsCanModify` | boolean | no | Whether guests can modify |
| `guestsCanInviteOthers` | boolean | no | Whether guests can invite others |

---

### `calendar_update_event`

Update an existing calendar event.

**Policy operation:** `update_event`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `calendarId` | string | yes | Calendar ID |
| `eventId` | string | yes | Event ID |
| `summary` | string | no | Event title |
| `description` | string | no | Event description |
| `location` | string | no | Event location |
| `start` | object | no | `{ dateTime: string, timeZone?: string }` |
| `end` | object | no | `{ dateTime: string, timeZone?: string }` |
| `attendees` | array | no | `[{ email: string }]` |
| `visibility` | string | no | `"default"`, `"public"`, or `"private"` |
| `guestsCanModify` | boolean | no | Whether guests can modify |
| `guestsCanInviteOthers` | boolean | no | Whether guests can invite others |

## Guards

### `require_organizer_self`

Available on `update_event`. When enabled, the agent can only update events where the connected account is the organizer:

```yaml
update_event:
  allow: true
  guards:
    require_organizer_self: true
```

## Default policy

The default policy allows read operations and disables writes:

```yaml
provider: google_calendar
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
```

When you enable `create_event` or `update_event`, the default mutations provide safe defaults — attendees are stripped, and guest permissions are removed.

## Not implemented

`delete_event` is not implemented. There is no code path to delete a calendar event through Gatelet, regardless of policy.

## Example: read-only with constrained writes

```yaml
provider: google_calendar
account: me@gmail.com

operations:
  list_calendars:
    allow: true

  list_events:
    allow: true

  get_event:
    allow: true

  create_event:
    allow: true
    constraints:
      - field: calendarId
        rule: must_equal
        value: "primary"
    mutations:
      - field: attendees
        action: delete
      - field: visibility
        action: set
        value: "private"

  update_event:
    allow: true
    constraints:
      - field: calendarId
        rule: must_equal
        value: "primary"
    guards:
      require_organizer_self: true
    mutations:
      - field: attendees
        action: delete
```
