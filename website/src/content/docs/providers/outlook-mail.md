---
title: Outlook Mail
description: Outlook Mail provider — tools, parameters, content filters, and default policy
---

The Outlook Mail provider connects to the Microsoft Graph API via OAuth2 (PKCE). It includes the same content filter pipeline as Gmail for protecting sensitive email content.

## Tools

### `outlook_mail_search`

Search Outlook Mail messages using KQL search syntax.

**Policy operation:** `search`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `search` | string | no | KQL search query (e.g. `from:user@example.com subject:meeting`). Omit to list recent messages. |
| `filter` | string | no | OData `$filter` expression (e.g. `isRead eq false`). Cannot be combined with `$orderby` when `$search` is present. |
| `folderId` | string | no | Folder ID to search in (e.g. `Inbox`, `SentItems`). Omit to search all folders. |
| `maxResults` | number | no | Max messages to return (default 10, max 50) |

Returns message IDs and snippets. Search results are filtered by [content filters](/concepts/content-filters/) when guards are configured. Use `outlook_mail_read_message` to get full content.

---

### `outlook_mail_read_message`

Read the full content of an Outlook Mail message by ID.

**Policy operation:** `read_message`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Outlook message ID (from `outlook_mail_search` results) |

Returns parsed headers (from, to, subject, date) and plaintext body. Messages may be blocked by [content filters](/concepts/content-filters/) (2FA codes, password resets, etc.).

---

### `outlook_mail_create_draft`

Create a new draft email. The draft is saved but NOT sent — the user must review and send manually.

**Policy operation:** `create_draft`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `to` | string | yes | Recipient email address(es), comma-separated |
| `subject` | string | yes | Email subject line |
| `body` | string | yes | Email body in plain text |
| `cc` | string | no | CC address(es), comma-separated |
| `bcc` | string | no | BCC address(es), comma-separated |
| `conversationId` | string | no | Conversation ID to associate the draft with (for replies) |

---

### `outlook_mail_list_drafts`

List existing draft emails.

**Policy operation:** `list_drafts`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `maxResults` | number | no | Max drafts to return (default 10, max 50) |

---

### `outlook_mail_send`

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

### `outlook_mail_reply`

Reply to an existing email. Uses the Graph API native reply endpoint. The reply is sent immediately.

**Policy operation:** `reply`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Outlook message ID to reply to |
| `body` | string | yes | Reply body in plain text |
| `replyAll` | boolean | no | If true, reply to all recipients (default: false) |

:::caution
Reply is disabled in the default policy. The default mutations force `replyAll: false` to prevent accidental reply-all.
:::

---

### `outlook_mail_categorize`

Add or remove categories from a message. Uses string category names (e.g. "Blue Category", "Red Category").

**Policy operation:** `categorize`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Outlook message ID |
| `addCategories` | array | no | Category names to add |
| `removeCategories` | array | no | Category names to remove |

---

### `outlook_mail_archive`

Archive a message by moving it to the Archive folder. The message remains accessible via search.

**Policy operation:** `archive`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Outlook message ID to archive |

---

### `outlook_mail_list_folders`

List all mail folders in the Outlook account. Returns folder IDs, display names, and unread counts. Use the returned folder IDs with `outlook_mail_move` or `outlook_mail_search`.

**Policy operation:** `list_folders`

This tool takes no parameters.

---

### `outlook_mail_move`

Move a message to a different folder. Use well-known folder names (e.g. `Inbox`, `Archive`, `SentItems`) or folder IDs from `outlook_mail_list_folders`.

**Policy operation:** `move`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Outlook message ID to move |
| `folderId` | string | yes | Destination folder ID or well-known name |

The default policy includes a `protected_folders` guard that prevents moving messages to `deleteditems` (Trash) and `junkemail` (Spam).

---

### `outlook_mail_flag`

Set or clear the follow-up flag and importance level on a message.

**Policy operation:** `flag`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string | yes | Outlook message ID |
| `flagStatus` | string | no | `"flagged"`, `"notFlagged"`, or `"complete"` |
| `importance` | string | no | `"low"`, `"normal"`, or `"high"` |

## Content filters

The `search` and `read_message` operations support the same content filter pipeline as Gmail, configured via `guards`. See [Content Filters](/concepts/content-filters/) for full documentation.

The default policy includes additional Microsoft-specific blocked sender domains (`account.live.com`, `login.microsoftonline.com`) alongside the standard ones.

## Default policy

```yaml
provider: outlook_mail
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
        - account.live.com
        - login.microsoftonline.com
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
        - account.live.com
        - login.microsoftonline.com
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

  categorize:
    allow: true

  archive:
    allow: true

  list_folders:
    allow: true

  move:
    allow: true
    guards:
      protected_folders:
        - deleteditems
        - junkemail

  flag:
    allow: true
```

## Not implemented

`delete_message` is not implemented. There is no code path to permanently delete an Outlook Mail message through Gatelet.

## Example: full agent with alias-restricted sending

```yaml
provider: outlook_mail
account: me@outlook.com

operations:
  search:
    allow: true
    guards:
      block_subjects:
        - password reset
        - verification code
        - 2FA
      block_sender_domains:
        - accountprotection.microsoft.com
        - account.live.com

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

  categorize:
    allow: true

  archive:
    allow: true

  list_folders:
    allow: true

  move:
    allow: true
    guards:
      protected_folders:
        - deleteditems
        - junkemail

  flag:
    allow: true
```
