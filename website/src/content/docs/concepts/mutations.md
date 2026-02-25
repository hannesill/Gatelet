---
title: Mutations
description: Silently modify parameters before upstream calls
---

Mutations modify tool call parameters before they're sent upstream. The agent never sees the modification — it believes its original parameters were used. This is useful for enforcing defaults, stripping fields, and overriding values.

## How mutations work

Mutations run after constraints pass but before the provider executes. They operate on a cloned copy of the parameters (via `structuredClone`) to prevent aliasing bugs.

```yaml
create_event:
  allow: true
  mutations:
    - field: attendees
      action: delete
    - field: visibility
      action: set
      value: "private"
```

In this example, even if the agent sends attendees and a visibility setting, the upstream call will have no attendees and `visibility: "private"`.

## Mutation actions

### `set`

Set the field to a given value. If the field doesn't exist, it's created.

```yaml
mutations:
  - field: visibility
    action: set
    value: "private"
```

Supports any YAML value type — strings, numbers, booleans, arrays, objects:

```yaml
mutations:
  - field: maxResults
    action: set
    value: 10
  - field: replyAll
    action: set
    value: false
  - field: attendees
    action: set
    value: []
```

### `delete`

Remove the field entirely from the parameters.

```yaml
mutations:
  - field: attendees
    action: delete
  - field: cc
    action: delete
  - field: bcc
    action: delete
```

## Nested fields

Mutations support dot-notation for nested fields:

```yaml
mutations:
  - field: start.timeZone
    action: set
    value: "America/New_York"
  - field: end.timeZone
    action: set
    value: "America/New_York"
```

## Execution order

Mutations are applied in the order they're listed. This matters when one mutation depends on another:

```yaml
mutations:
  # First: strip all attendees
  - field: attendees
    action: delete
  # Then: set visibility (order doesn't matter here, but listed for clarity)
  - field: visibility
    action: set
    value: "default"
```

## Constraints + mutations

Constraints are evaluated **before** mutations. This means constraints check the original parameters, not the mutated ones. The pipeline is:

1. **Constraints** — validate original params → reject if any fail
2. **Mutations** — modify cloned params
3. **Field policy** — strip disallowed fields
4. **Execute** — forward mutated params to provider

## Examples

### Strip attendees from calendar events

Prevent the agent from inviting people:

```yaml
create_event:
  allow: true
  mutations:
    - field: attendees
      action: delete
    - field: guestsCanModify
      action: delete
    - field: guestsCanInviteOthers
      action: delete
```

### Force private visibility

```yaml
create_event:
  allow: true
  mutations:
    - field: visibility
      action: set
      value: "private"
```

### Cap search results

```yaml
search:
  allow: true
  mutations:
    - field: maxResults
      action: set
      value: 10
```

### Strip CC/BCC from drafts

```yaml
create_draft:
  allow: true
  mutations:
    - field: cc
      action: delete
    - field: bcc
      action: delete
```

### Force single reply (no reply-all)

```yaml
reply:
  allow: true
  mutations:
    - field: replyAll
      action: set
      value: false
```
