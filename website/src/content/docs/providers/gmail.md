---
title: Gmail
description: Gmail provider — tools, parameters, content filters, and default policy
---

The Gmail provider connects to the Gmail API via OAuth2 using the `googleapis` library. It includes a content filter pipeline for protecting sensitive email content.

## Tools

### `gmail_search`

Search Gmail messages using Gmail search syntax.

**Policy operation:** `search`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Gmail search query. Omit to list recent inbox messages. |
| `maxResults` | number | no | Max messages to return (default 10, max 50) |

Supports Gmail search syntax: `is:unread`, `from:person@example.com`, `subject:meeting`, `after:2026/01/01`, `has:attachment`, `in:inbox`.

Returns message IDs and snippets. Search results are filtered by [content filters](/concepts/content-filters/) when guards are configured. Use `gmail_read_message` to get full content.

---

### `gmail_read_message`

Read the full content of a Gmail message by ID.

**Policy operation:** `read_message`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Gmail message ID (from `gmail_search` results) |

Returns parsed headers (from, to, subject, date) and plaintext body. Messages may be blocked by [content filters](/concepts/content-filters/) (2FA codes, password resets, etc.).

---

### `gmail_create_draft`

Create a new draft email. The draft is saved but NOT sent — the user must review and send manually.

**Policy operation:** `create_draft`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `to` | string | yes | Recipient email address(es), comma-separated |
| `subject` | string | yes | Email subject line |
| `body` | string | yes | Email body in plain text |
| `cc` | string | no | CC address(es), comma-separated |
| `bcc` | string | no | BCC address(es), comma-separated |
| `inReplyTo` | string | no | Message-ID header of the message being replied to |
| `threadId` | string | no | Thread ID to associate the draft with (for replies) |

---

### `gmail_list_drafts`

List existing draft emails.

**Policy operation:** `list_drafts`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `maxResults` | number | no | Max drafts to return (default 10, max 50) |

---

### `gmail_send`

Send an email directly. The email is sent immediately.

**Policy operation:** `send`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `to` | string | yes | Recipient email address(es), comma-separated |
| `subject` | string | yes | Email subject line |
| `body` | string | yes | Email body in plain text |
| `from` | string | no | Sender address (alias). If omitted, uses account default. |
| `cc` | string | no | CC address(es), comma-separated |
| `bcc` | string | no | BCC address(es), comma-separated |

:::caution
Send is disabled in the default policy. Enable it only if your use case requires it, and consider adding constraints (e.g. restricting the sender to an alias).
:::

---

### `gmail_reply`

Reply to an existing email. Fetches the original message to build correct threading headers. The reply is sent immediately.

**Policy operation:** `reply`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Gmail message ID to reply to |
| `body` | string | yes | Reply body in plain text |
| `replyAll` | boolean | no | If true, reply to all recipients (default: false) |

:::caution
Reply is disabled in the default policy. The default mutations force `replyAll: false` to prevent accidental reply-all.
:::

---

### `gmail_label`

Add or remove labels from a Gmail message.

**Policy operation:** `label`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Gmail message ID |
| `addLabelIds` | array | no | Label IDs to add (e.g. `["STARRED", "IMPORTANT"]`) |
| `removeLabelIds` | array | no | Label IDs to remove |

The default policy includes a `protected_labels` guard that prevents applying `TRASH` and `SPAM` labels.

---

### `gmail_archive`

Archive a Gmail message by removing the INBOX label. The message remains accessible via search and labels.

**Policy operation:** `archive`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Gmail message ID to archive |

## Content filters

The `search` and `read_message` operations support a content filter pipeline configured via `guards`. See [Content Filters](/concepts/content-filters/) for full documentation.

## Default policy

```yaml
provider: google_gmail
account: "{account}"

operations:
  search:
    allow: true
    mutations:
      - field: maxResults
        action: set
        value: 10
    guards:
      block_subjects:
        - password reset
        - reset your password
        - verification code
        - security code
        - two-factor
        - 2FA
        - one-time password
        - one-time pin
        - one-time code
        - OTP
        - sign-in attempt
        - login alert
        - security alert
        - confirm your identity
        - einmalcode
        - sicherheitswarnung
        - sicherheitscode
      block_sender_domains:
        - accounts.google.com
        - accountprotection.microsoft.com
      redact_patterns:
        - pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b"
          replace: "[REDACTED-SSN]"
        - pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\b\\d{4}[\\s-]?\\d{6}[\\s-]?\\d{5}\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\bCVV[:\\s]*\\d{3,4}\\b"
          replace: "CVV [REDACTED]"
        - pattern: "\\b[A-Z]{1,2}\\d{6,9}\\b"
          replace: "[REDACTED-PASSPORT]"
        - pattern: "\\brouting[:\\s#]*\\d{9}\\b"
          replace: "routing [REDACTED]"
        - pattern: "\\baccount[:\\s#]*\\d{8,17}\\b"
          replace: "account [REDACTED]"

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
        - one-time password
        - one-time pin
        - one-time code
        - OTP
        - sign-in attempt
        - login alert
        - security alert
        - confirm your identity
        - einmalcode
        - sicherheitswarnung
        - sicherheitscode
      block_sender_domains:
        - accounts.google.com
        - accountprotection.microsoft.com
      redact_patterns:
        - pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b"
          replace: "[REDACTED-SSN]"
        - pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\b\\d{4}[\\s-]?\\d{6}[\\s-]?\\d{5}\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\bCVV[:\\s]*\\d{3,4}\\b"
          replace: "CVV [REDACTED]"
        - pattern: "\\b[A-Z]{1,2}\\d{6,9}\\b"
          replace: "[REDACTED-PASSPORT]"
        - pattern: "\\brouting[:\\s#]*\\d{9}\\b"
          replace: "routing [REDACTED]"
        - pattern: "\\baccount[:\\s#]*\\d{8,17}\\b"
          replace: "account [REDACTED]"

  create_draft:
    allow: true
    constraints:
      - field: to
        rule: must_not_be_empty
      - field: subject
        rule: must_not_be_empty
    mutations:
      - field: cc
        action: delete
      - field: bcc
        action: delete

  list_drafts:
    allow: true
    mutations:
      - field: maxResults
        action: set
        value: 10

  send:
    allow: false
    constraints:
      - field: to
        rule: must_not_be_empty
      - field: subject
        rule: must_not_be_empty
    mutations:
      - field: cc
        action: delete
      - field: bcc
        action: delete

  reply:
    allow: false
    constraints:
      - field: messageId
        rule: must_not_be_empty
      - field: body
        rule: must_not_be_empty
    mutations:
      - field: replyAll
        action: set
        value: false

  label:
    allow: true
    guards:
      protected_labels:
        - TRASH
        - SPAM

  archive:
    allow: true
```

## Not implemented

`delete_message` is not implemented. There is no code path to permanently delete a Gmail message through Gatelet.

## Example: full agent with alias-restricted sending

```yaml
provider: google_gmail
account: me@gmail.com

operations:
  search:
    allow: true
    guards:
      block_subjects:
        - password reset
        - verification code
        - 2FA
      block_sender_domains:
        - accounts.google.com

  read_message:
    allow: true
    guards:
      block_subjects:
        - password reset
        - verification code
        - 2FA

  create_draft:
    allow: true

  list_drafts:
    allow: true

  send:
    allow: true
    constraints:
      - field: from
        rule: must_match
        value: ".*\\+agent@.*"
      - field: to
        rule: must_not_be_empty
      - field: subject
        rule: must_not_be_empty
    mutations:
      - field: cc
        action: delete
      - field: bcc
        action: delete

  reply:
    allow: true
    mutations:
      - field: replyAll
        action: set
        value: false

  label:
    allow: true
    guards:
      protected_labels:
        - TRASH
        - SPAM

  archive:
    allow: true
```
