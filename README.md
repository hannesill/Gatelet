# Gatelet

Self-hosted MCP permission proxy for AI agents. Sits between your AI agent and personal services (Google Calendar, Outlook Calendar), holding OAuth credentials in encrypted storage and enforcing fine-grained YAML policies — including payload mutation.

The agent connects via a policy-enforced MCP endpoint and can only perform operations the policy allows. Operations not listed are denied. Denied tools are invisible to the agent.

## How It Works

```
                                                    ┌──────────────┐
┌─────────┐     MCP/HTTP      ┌──────────┐        ┌▸│ Google Cal   │
│ AI Agent │ ───── :4000 ────▸ │ Gatelet  │ ───────┤ └──────────────┘
│          │  bearer token     │          │        │ ┌──────────────┐
└─────────┘                    └──────────┘        └▸│ Outlook Cal  │
                                    │                └──────────────┘
                               :4001 Admin
                               (localhost only)
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

Click "Connect Google Calendar" or "Connect Outlook Calendar" to link your accounts. Built-in OAuth credentials are included — no app registration needed for Google. For Outlook, built-in credentials are also included but may require admin consent on organizational accounts (universities, enterprises).

Docker is the recommended deployment method — it provides the filesystem and network isolation that the security model depends on.

## Supported Providers

| Provider | Tools | Built-in OAuth | Notes |
|---|---|---|---|
| Google Calendar | list calendars, list/get/create/update events | Yes | Works out of the box |
| Outlook Calendar | list calendars, list/get/create/update events | Yes | Personal accounts work immediately. Organizational accounts may require IT admin consent |

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

## Security Model

- **Two trust domains:** Agent-facing (`:4000`) and admin-facing (`:4001`) are separate servers on separate ports
- **Deny by default:** Operations not listed in a policy are denied
- **Hidden denied tools:** Agents never see tools they can't use — they don't know they exist
- **Defense in depth:** Dangerous operations (email send, calendar delete) are not implemented as code
- **Encrypted at rest:** All OAuth credentials are encrypted with XSalsa20-Poly1305 (libsodium) in SQLite
- **HTTP transport only:** Gatelet is never a child process of the agent — no shared memory, no stdio
- **Audit everything:** Every tool call is logged with original params, mutated params, result, and timing
- **Payload mutation:** Even when an operation is allowed, mutations can strip or override fields before the upstream call

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GATELET_MCP_PORT` | `4000` | MCP server port (agent-facing) |
| `GATELET_ADMIN_PORT` | `4001` | Admin API port (human-facing) |
| `GATELET_DATA_DIR` | `~/.gatelet/data` | SQLite DB + master key location |
| `GATELET_ADMIN_TOKEN` | auto-generated | Admin dashboard token |
| `GOOGLE_CLIENT_ID` | built-in | Override Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | built-in | Override Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | built-in | Override Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | built-in | Override Microsoft OAuth client secret |

OAuth credentials can also be configured through the admin dashboard under OAuth Settings.

## Docker

The `docker-compose.yml` uses two networks for isolation:

- **gatelet-internal** — Other containers (your agent) connect to Gatelet on `:4000`
- **gatelet-egress** — Allows Gatelet to reach external APIs (Google, Microsoft)

Admin port is bound to `127.0.0.1` only — not accessible from the network.

```bash
npm run docker:build   # Build production image
docker compose up -d   # Start with compose
```

## Development

For local development only — runs without container isolation, not suitable for production.

```bash
npm install
npm run dev          # Start server with tsx
npm test             # Run tests (vitest)
npm run test:watch   # Watch mode
npm run build        # Build (tsup → dist/)
npm start            # Run production build
```

### Project Structure

```
src/
  admin/       Admin API (Hono on :4001) + server-rendered dashboard
  db/          SQLite + encrypted credential storage (libsodium)
  mcp/         MCP server (raw HTTP on :4000, Streamable HTTP transport)
  policy/      Policy engine (pure functions, no side effects)
  providers/   Provider implementations
    google-calendar/    Google Calendar via googleapis
    outlook-calendar/   Outlook Calendar via Microsoft Graph
  config.ts    Environment variable config
  index.ts     Entry point
```

## License

MIT
