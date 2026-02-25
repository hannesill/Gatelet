---
title: Policies
description: YAML policy format and deny-by-default model
---

Policies are YAML files that define what an agent can do with a connected account. Each connection has exactly one policy. Operations not listed in the policy are denied and invisible to the agent.

## Structure

Every policy has three required fields:

```yaml
provider: google_calendar
account: me@gmail.com

operations:
  list_calendars:
    allow: true

  list_events:
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
```

### `provider`

The provider identifier. Must match the connection's provider type:
- `google_calendar`
- `outlook_calendar`
- `google_gmail`

### `account`

The email address of the connected account. Used for display and identification.

### `operations`

A map of operation names to their policies. Each operation can have:

| Field | Type | Description |
|---|---|---|
| `allow` | `boolean` | Whether the operation is permitted |
| `constraints` | `array` | Input validation rules (checked before execution) |
| `mutations` | `array` | Parameter modifications (applied before upstream call) |
| `guards` | `object` | Post-execution filters (used by content filter pipeline) |
| `allowed_fields` | `array` | Whitelist of accepted input fields |
| `denied_fields` | `array` | Blacklist of stripped input fields |

## Deny by default

The policy engine follows a strict deny-by-default model:

1. **Operation not listed** — denied, tool is not registered in MCP
2. **Operation listed with `allow: false`** — denied, tool is not registered in MCP
3. **Operation listed with `allow: true`** — tool is registered, constraints are checked on each call

In cases 1 and 2, the agent never sees the tool. It doesn't get a "permission denied" error — the tool simply doesn't exist in the agent's tool list.

```yaml
operations:
  list_events:
    allow: true          # ✓ Agent sees this tool

  create_event:
    allow: false         # ✗ Agent doesn't see this tool

  # update_event          # ✗ Not listed → doesn't exist
  # delete_event          # ✗ Not implemented in code → impossible
```

## Hidden tools

When Gatelet registers tools with the MCP protocol, it only includes tools whose corresponding operation has `allow: true`. This is a critical security feature:

- The agent cannot call a tool it doesn't know about
- The agent cannot be tricked via prompt injection into calling a hidden tool
- The agent's LLM doesn't waste context on tools it can't use

This is fundamentally different from returning "access denied" — that response tells the agent the tool exists and can encourage retry attempts.

## Default policies

When you connect a new account, Gatelet assigns a restrictive default policy per provider:

- **Calendar providers** — list and read operations are allowed; create and update are disabled
- **Gmail** — search, read, create draft, list drafts, label, and archive are allowed; send and reply are disabled

You can edit the policy at any time in the dashboard's policy editor.

## Editing policies

Policies are edited in the admin dashboard under each connection's settings. The dashboard provides both:

- **Form editor** — visual interface for toggling operations and adding constraints/mutations
- **YAML editor** — raw YAML for advanced configuration

Changes take effect immediately — the tool registry is rebuilt on save.

## Next steps

- [Constraints](/concepts/constraints/) — validate input fields
- [Mutations](/concepts/mutations/) — modify fields before upstream call
- [Field Policies](/concepts/field-policies/) — whitelist/blacklist input fields
- [Content Filters](/concepts/content-filters/) — filter email content
