---
title: Field Policies
description: Whitelist or blacklist input fields per operation
---

Field policies restrict which fields the agent is allowed to include in a tool call. They provide an additional layer of control beyond constraints and mutations.

## How field policies work

Field policies are applied after mutations but before the provider executes. They operate on the parameter keys:

- **`allowed_fields`** — whitelist. Only these fields are accepted; all others are stripped.
- **`denied_fields`** — blacklist. These fields are stripped; all others are accepted.

Use one or the other — not both. If both are specified, the policy parser will warn and `allowed_fields` takes precedence.

## `allowed_fields` (whitelist)

Only the listed fields are accepted. All other fields are silently removed.

```yaml
create_event:
  allow: true
  allowed_fields:
    - calendarId
    - summary
    - start
    - end
    - description
    - location
```

In this example, if the agent sends `attendees`, `visibility`, or `guestsCanModify`, those fields are stripped before the upstream call. The agent doesn't receive an error — the fields are simply not forwarded.

## `denied_fields` (blacklist)

The listed fields are stripped. All other fields are accepted.

```yaml
create_event:
  allow: true
  denied_fields:
    - attendees
    - guestsCanModify
    - guestsCanInviteOthers
```

## When to use field policies vs mutations

| Approach | Use case |
|---|---|
| **Field policies** | Remove fields you never want the agent to set, regardless of value |
| **Mutations (delete)** | Remove specific fields as part of a broader mutation strategy |
| **Mutations (set)** | Override a field to a specific value |
| **Constraints** | Reject the call if a field has the wrong value |

Field policies and mutations can be combined. The pipeline order is:

1. Constraints (validate)
2. Mutations (modify)
3. Field policy (strip)
4. Execute (forward)

## Examples

### Calendar: only allow basic event fields

```yaml
create_event:
  allow: true
  allowed_fields:
    - calendarId
    - summary
    - description
    - location
    - start
    - end
```

### Gmail: deny BCC and CC

```yaml
create_draft:
  allow: true
  denied_fields:
    - cc
    - bcc
```

### Combine with mutations

Field policies and mutations work together. Mutations run first, then field policies strip remaining fields:

```yaml
create_event:
  allow: true
  mutations:
    - field: visibility
      action: set
      value: "private"
  denied_fields:
    - attendees
    - guestsCanModify
    - guestsCanInviteOthers
```

In this example, visibility is forced to "private" by the mutation, and attendee-related fields are stripped by the field policy.
