---
title: Constraints
description: Validate input fields before execution
---

Constraints validate input fields before a tool call is forwarded upstream. If any constraint fails, the call is rejected with a descriptive error message — so the agent can self-correct.

## How constraints work

Constraints are evaluated in order before the provider executes. If a constraint fails:
1. The upstream API is never called
2. The agent receives an error message showing the expected vs actual value
3. The call is logged in the audit trail as denied

```yaml
create_event:
  allow: true
  constraints:
    - field: calendarId
      rule: must_equal
      value: "primary"
    - field: summary
      rule: must_not_be_empty
```

## Constraint rules

### `must_equal`

Field must exactly match the given value.

```yaml
constraints:
  - field: calendarId
    rule: must_equal
    value: "primary"
```

If the agent tries `calendarId: "work"`, the error reads:
```
Constraint failed: calendarId must_equal "primary", got "work"
```

### `must_be_one_of`

Field must be one of the values in the given array.

```yaml
constraints:
  - field: calendarId
    rule: must_be_one_of
    value:
      - "primary"
      - "work"
      - "family"
```

### `must_not_be_empty`

Field must not be null, undefined, empty string, whitespace-only string, or empty array.

```yaml
constraints:
  - field: to
    rule: must_not_be_empty
  - field: subject
    rule: must_not_be_empty
```

This is useful for operations like sending email where certain fields are always required.

### `must_match`

Field must match a regex pattern. Uses JavaScript regex syntax.

```yaml
constraints:
  - field: from
    rule: must_match
    value: "\\+agent@"
```

This example restricts the sender to a Gmail alias like `user+agent@gmail.com`, preventing the agent from sending as the primary address.

## Nested fields

Constraints support dot-notation for nested fields:

```yaml
constraints:
  - field: start.timeZone
    rule: must_equal
    value: "America/New_York"
```

## Multiple constraints

Multiple constraints on the same operation are evaluated in order. All must pass for the call to proceed:

```yaml
create_event:
  allow: true
  constraints:
    - field: calendarId
      rule: must_equal
      value: "primary"
    - field: summary
      rule: must_not_be_empty
    - field: start.timeZone
      rule: must_be_one_of
      value:
        - "America/New_York"
        - "America/Chicago"
        - "America/Los_Angeles"
```

## Examples

### Restrict calendar writes to primary calendar

```yaml
create_event:
  allow: true
  constraints:
    - field: calendarId
      rule: must_equal
      value: "primary"

update_event:
  allow: true
  constraints:
    - field: calendarId
      rule: must_equal
      value: "primary"
```

### Require email fields

```yaml
send:
  allow: true
  constraints:
    - field: to
      rule: must_not_be_empty
    - field: subject
      rule: must_not_be_empty
    - field: body
      rule: must_not_be_empty
```

### Restrict sender to agent alias

```yaml
send:
  allow: true
  constraints:
    - field: from
      rule: must_match
      value: "\\+agent@"
```
