# Gatelet

Self-hosted MCP permission proxy for AI agents. Sits between your AI agent and personal services (Google Calendar, Outlook Calendar, Gmail), holding OAuth credentials in encrypted storage and enforcing fine-grained YAML policies — including payload mutation.

The agent connects via a policy-enforced MCP endpoint and can only perform operations the policy allows. Operations not listed are denied. Denied tools are invisible to the agent.

## How It Works

```
                                                    ┌──────────────┐
                                                   ┌▸│ Google Cal   │
┌─────────┐     MCP/HTTP      ┌──────────┐        │ └──────────────┘
│ AI Agent │ ───── :4000 ────▸ │ Gatelet  │ ───────┤ ┌──────────────┐
│          │  bearer token     │          │        ├▸│ Outlook Cal  │
└─────────┘                    └──────────┘        │ └──────────────┘
                                    │              │ ┌──────────────┐
                               :4001 Admin         └▸│ Gmail        │
                               (localhost only)      └──────────────┘
```

1. You connect your accounts (Google, Microsoft) via the admin dashboard on `:4001`
2. You write YAML policies that define what the agent can do
3. Agent connects to `:4000/mcp` with an API key — sees only allowed tools
4. On each tool call: validate constraints, apply mutations, call upstream API
5. Every call is audit-logged with parameters, result, and timing

## Quick Start

```bash
docker compose up -d
docker compose logs gatelet  # grab the admin token
open http://localhost:4001   # paste the token to log in
```

The dashboard walks you through setup: generate an API key, connect your accounts via OAuth, copy the MCP config into your agent. Built-in OAuth credentials are included — no app registration needed for Google. For Outlook, built-in credentials are also included but may require admin consent on organizational accounts.

Docker is the recommended deployment method — it provides the filesystem and network isolation that the security model depends on.

## Supported Providers

| Provider | Tools | Built-in OAuth |
|---|---|---|
| Google Calendar | list calendars, list/get/create/update events | Yes |
| Outlook Calendar | list calendars, list/get/create/update events | Yes |
| Gmail | search, read, create draft, list drafts, send, reply, label, archive | Yes |

No delete operations are implemented for any provider. Absence of code is the strongest guarantee.

## Policy Example

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
        action: set
        value: []
      - field: visibility
        action: set
        value: "private"

  # update_event: not listed → denied by default
  # delete_event: not implemented in code → impossible
```

**Constraints** validate input fields — reject the call if violated. Denial messages include expected vs actual values so the agent can self-correct.

**Mutations** modify fields before sending upstream — the agent never knows. Use these to strip attendees, force private visibility, or set default values.

## Email Content Filters

Gmail's `read_message` operation runs messages through a content filter pipeline before returning them to the agent. Filters are configured as `guards` in the policy YAML.

### Filter Pipeline

Messages pass through three stages in order:

1. **Subject blocking** — If the subject contains any blocked pattern, the entire message is blocked
2. **Sender domain blocking** — If the sender's email domain matches, blocked
3. **PII redaction** — Regex patterns replace sensitive data in the message body

Blocked messages return a notice — the agent knows the message exists but cannot read its content.

### Default Blocked Subjects

Messages matching these are blocked entirely (case-insensitive substring match):

`password reset` `reset your password` `verification code` `security code` `two-factor` `2FA` `one-time password` `OTP` `sign-in attempt` `login alert` `security alert` `confirm your identity`

### Default Blocked Sender Domains

`accounts.google.com` `accountprotection.microsoft.com`

### Default PII Redaction

| What | Example | Replaced with |
|---|---|---|
| Social Security Number | `123-45-6789` | `[REDACTED-SSN]` |
| Credit card (4x4) | `4111 1111 1111 1111` | `[REDACTED-CC]` |
| Credit card (Amex) | `3782 822463 10005` | `[REDACTED-CC]` |
| CVV code | `CVV: 123` | `CVV [REDACTED]` |
| Passport number | `C12345678` | `[REDACTED-PASSPORT]` |
| Bank routing number | `routing: 021000021` | `routing [REDACTED]` |
| Bank account number | `account: 12345678901` | `account [REDACTED]` |

Prices, dates, order numbers, tracking numbers, phone numbers, flight numbers, ZIP codes, and confirmation codes are **not redacted** — agents need these to be useful.

### Customizing Filters

Edit the policy YAML for any Gmail connection in the admin dashboard:

```yaml
operations:
  read_message:
    allow: true
    guards:
      block_subjects:
        - my custom blocked subject
      block_sender_domains:
        - spam-domain.com
      redact_patterns:
        - pattern: "\\bSECRET-\\d+\\b"
          replace: "[REDACTED]"
```

Patterns use JavaScript regex syntax with case-insensitive and global flags.

## Security Model

- **Two trust domains:** Agent-facing (`:4000`) and admin-facing (`:4001`) are separate servers on separate ports
- **Deny by default:** Operations not listed in a policy are denied
- **Hidden denied tools:** Agents never see tools they can't use — they don't know they exist
- **Defense in depth:** Dangerous operations (calendar delete) are not implemented as code
- **Encrypted at rest:** All OAuth credentials are encrypted with XSalsa20-Poly1305 (libsodium) in SQLite
- **HTTP transport only:** Gatelet is never a child process of the agent — no shared memory, no stdio
- **Audit everything:** Every tool call is logged with original params, mutated params, result, and timing
- **Payload mutation:** Even when an operation is allowed, mutations can strip or override fields before the upstream call
- **Rate limiting:** Failed admin auth attempts are rate-limited per IP (10 per minute)

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GATELET_MCP_PORT` | `4000` | MCP server port (agent-facing) |
| `GATELET_ADMIN_PORT` | `4001` | Admin API port (human-facing) |
| `GATELET_DATA_DIR` | `~/.gatelet/data` | SQLite DB + master key location |
| `GATELET_ADMIN_TOKEN` | auto-generated | Admin dashboard token |

OAuth credentials can be configured through the admin dashboard under OAuth Settings.

## Docker

The `docker-compose.yml` uses two networks for isolation:

- **gatelet-internal** — Other containers (your agent) connect to Gatelet on `:4000`. This port is not published to the host.
- **gatelet-egress** — Allows Gatelet to reach external APIs (Google, Microsoft)

Admin port is bound to `127.0.0.1` only — not accessible from the network.

```bash
npm run docker:build   # Build production image
docker compose up -d   # Start with compose
```

## Development

```bash
npm install
npm run dev          # Start API + dashboard (Vite dev server)
npm test             # Run tests (vitest)
npm run test:watch   # Watch mode
npm run build        # Build dashboard + API (tsup → dist/)
npm start            # Run production build
```

### Doctor

Health checks for verifying your setup:

```bash
npm run doctor          # Run all checks
npm run doctor:fix      # Auto-fix what's fixable
```

Checks data directory, master key, database schema, admin token, port availability, connections, OAuth tokens, encryption, providers, and policy validity.

### Project Structure

```
src/
  admin/       Admin API (Hono on :4001)
  db/          SQLite + encrypted credential storage (libsodium)
  doctor/      Health checks (CLI + admin API)
  mcp/         MCP server (raw HTTP on :4000, Streamable HTTP transport)
  policy/      Policy engine (pure functions, no side effects)
  providers/   Provider implementations
    google-calendar/    Google Calendar via googleapis
    outlook-calendar/   Outlook Calendar via Microsoft Graph
    gmail/              Gmail via googleapis
    email/              Shared email types, content filters, HTML stripping
  config.ts    Environment variable config
  index.ts     Entry point
  cli.ts       CLI entry point (gatelet, gatelet doctor)
dashboard/     Admin dashboard (React, Vite, Tailwind)
```

## License

MIT
