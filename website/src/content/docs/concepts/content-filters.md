---
title: Content Filters & Guards
description: Email content filtering, subject blocking, domain blocking, PII redaction, label guards, and organizer guards
---

Gmail's `search` and `read_message` operations run messages through a content filter pipeline before returning them to the agent. Filters protect sensitive content like 2FA codes, password resets, and financial data.

## Filter pipeline

Messages pass through three stages in order:

1. **Subject blocking** — if the subject contains any blocked pattern, the entire message is blocked
2. **Sender domain blocking** — if the sender's email domain matches, the message is blocked
3. **PII redaction** — regex patterns replace sensitive data in the message body and snippet

Blocked messages return a notice — the agent knows the message exists but cannot read its content.

## Configuration

Content filters are configured as `guards` on the `search` and `read_message` operations in the policy YAML:

```yaml
operations:
  search:
    allow: true
    guards:
      block_subjects:
        - password reset
        - verification code
      block_sender_domains:
        - accounts.google.com
      redact_patterns:
        - pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b"
          replace: "[REDACTED-SSN]"

  read_message:
    allow: true
    guards:
      block_subjects:
        - password reset
        - verification code
      block_sender_domains:
        - accounts.google.com
      redact_patterns:
        - pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b"
          replace: "[REDACTED-SSN]"
```

## Subject blocking

If the email subject contains any blocked pattern (case-insensitive), the entire message is blocked. The agent sees a placeholder notice instead of the message content.

### Default blocked subjects

The default Gmail policy blocks these subjects:

- `password reset`
- `reset your password`
- `verification code`
- `security code`
- `two-factor`
- `2FA`
- `one-time password`
- `OTP`
- `sign-in attempt`
- `login alert`
- `security alert`
- `confirm your identity`
- `one-time pin`
- `one-time code`
- `einmalcode`
- `sicherheitswarnung`
- `sicherheitscode`

### Adding custom subjects

Add entries to the `block_subjects` array:

```yaml
guards:
  block_subjects:
    - password reset
    - my custom blocked subject
    - confidential
```

## Sender domain blocking

If the sender's email domain matches a blocked domain (or is a subdomain of it), the entire message is blocked. For example, blocking `accounts.google.com` also blocks `mail.accounts.google.com`.

### Default blocked domains

- `accounts.google.com`
- `accountprotection.microsoft.com`

### Adding custom domains

```yaml
guards:
  block_sender_domains:
    - accounts.google.com
    - spam-domain.com
    - internal-only.corp
```

## PII redaction

Regex patterns match against the message body and snippet, replacing sensitive data. Patterns use JavaScript regex syntax with case-insensitive and global flags.

### Default redaction patterns

| Pattern | Example | Replaced with |
|---|---|---|
| Social Security Number | `123-45-6789` | `[REDACTED-SSN]` |
| Credit card (4x4) | `4111 1111 1111 1111` | `[REDACTED-CC]` |
| Credit card (Amex) | `3782 822463 10005` | `[REDACTED-CC]` |
| CVV code | `CVV: 123` | `CVV [REDACTED]` |
| Passport number | `C12345678` | `[REDACTED-PASSPORT]` |
| Bank routing number | `routing: 021000021` | `routing [REDACTED]` |
| Bank account number | `account: 12345678901` | `account [REDACTED]` |

### What is NOT redacted

These are intentionally left unredacted — agents need them to be useful:

- Prices and currency amounts
- Dates
- Order numbers
- Tracking numbers
- Phone numbers
- Flight numbers
- ZIP codes
- Confirmation codes

### Custom redaction patterns

Add entries to the `redact_patterns` array:

```yaml
guards:
  redact_patterns:
    - pattern: "\\bSECRET-\\d+\\b"
      replace: "[REDACTED]"
    - pattern: "\\bINTERNAL-[A-Z]{3}-\\d{4}\\b"
      replace: "[REDACTED-INTERNAL]"
```

## Complete example

A Gmail policy with custom content filters:

```yaml
provider: google_gmail
account: me@gmail.com

operations:
  search:
    allow: true
    guards:
      block_subjects:
        - password reset
        - reset your password
        - verification code
        - security code
        - two-factor
        - 2FA
        - OTP
        - sign-in attempt
        - login alert
        - security alert
        - confidential memo
      block_sender_domains:
        - accounts.google.com
        - accountprotection.microsoft.com
        - hr-internal.company.com
      redact_patterns:
        - pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b"
          replace: "[REDACTED-SSN]"
        - pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\bPROJECT-[A-Z]+-\\d+\\b"
          replace: "[REDACTED-PROJECT]"

  read_message:
    allow: true
    guards:
      block_subjects:
        - password reset
        - reset your password
        - verification code
        - security code
        - two-factor
        - 2FA
        - OTP
        - sign-in attempt
        - login alert
        - security alert
        - confidential memo
      block_sender_domains:
        - accounts.google.com
        - accountprotection.microsoft.com
        - hr-internal.company.com
      redact_patterns:
        - pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b"
          replace: "[REDACTED-SSN]"
        - pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\bPROJECT-[A-Z]+-\\d+\\b"
          replace: "[REDACTED-PROJECT]"

  create_draft:
    allow: true
```

## Label guards

The `label` operation supports a `protected_labels` guard that prevents the agent from applying certain Gmail labels:

```yaml
label:
  allow: true
  guards:
    protected_labels:
      - TRASH
      - SPAM
```

This prevents the agent from moving messages to trash or marking them as spam. The default Gmail policy includes this guard.

## Organizer guard (Calendar)

Google Calendar and Outlook Calendar's `update_event` supports a `require_organizer_self` guard:

```yaml
update_event:
  allow: true
  guards:
    require_organizer_self: true
```

When enabled, the agent can only update events where the connected account is the organizer. This prevents modifying events created by others.
