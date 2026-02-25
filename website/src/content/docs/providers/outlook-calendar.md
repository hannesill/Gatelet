---
title: Outlook Calendar
description: Outlook Calendar provider — tools, parameters, and default policy
---

The Outlook Calendar provider connects to the Microsoft Graph API via OAuth2.

## Tools

### `outlook_list_calendars`

List all calendars accessible to the connected Microsoft account.

**Policy operation:** `list_calendars`

**Parameters:** None

---

### `outlook_list_events`

List events from a specific Outlook calendar.

**Policy operation:** `list_events`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `calendarId` | string | yes | Calendar ID |
| `startDateTime` | string | no | ISO 8601 datetime lower bound (for calendar view) |
| `endDateTime` | string | no | ISO 8601 datetime upper bound (for calendar view) |
| `filter` | string | no | OData `$filter` expression |
| `top` | number | no | Max events to return (default 50) |

:::note
The `filter` parameter is validated to prevent OData injection. Only safe filter expressions are accepted.
:::

---

### `outlook_get_event`

Get details of a specific Outlook calendar event.

**Policy operation:** `get_event`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `eventId` | string | yes | Event ID |

---

### `outlook_create_event`

Create a new Outlook calendar event.

**Policy operation:** `create_event`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `calendarId` | string | yes | Calendar ID |
| `subject` | string | yes | Event subject/title |
| `body` | object | no | `{ contentType?: "text" \| "html", content: string }` |
| `start` | object | yes | `{ dateTime: string, timeZone: string }` |
| `end` | object | yes | `{ dateTime: string, timeZone: string }` |
| `location` | object | no | `{ displayName: string }` |
| `attendees` | array | no | `[{ emailAddress: { address, name? }, type? }]` |
| `isAllDay` | boolean | no | Whether the event is all day |

Note that Outlook requires `timeZone` as an IANA time zone string (e.g. `"America/New_York"`), unlike Google Calendar where it's optional.

---

### `outlook_update_event`

Update an existing Outlook calendar event.

**Policy operation:** `update_event`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `eventId` | string | yes | Event ID |
| `subject` | string | no | Event subject/title |
| `body` | object | no | `{ contentType?: "text" \| "html", content: string }` |
| `start` | object | no | `{ dateTime: string, timeZone: string }` |
| `end` | object | no | `{ dateTime: string, timeZone: string }` |
| `location` | object | no | `{ displayName: string }` |
| `attendees` | array | no | `[{ emailAddress: { address, name? }, type? }]` |
| `isAllDay` | boolean | no | Whether the event is all day |

## Default policy

```yaml
provider: outlook_calendar
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
```

The default policy is read-only. Enable `create_event` and `update_event` as needed.

## Not implemented

`delete_event` is not implemented. There is no code path to delete an Outlook calendar event through Gatelet.

## Example: read-only with constrained creates

```yaml
provider: outlook_calendar
account: me@outlook.com

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
        value: "YOUR_CALENDAR_ID"
    mutations:
      - field: attendees
        action: delete
```
