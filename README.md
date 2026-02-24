# Gatelet

Self-hosted MCP permission proxy for AI agents. Sits between your AI agent and personal services (Google Calendar, etc.), enforcing fine-grained YAML policies with payload mutation.

## Quick Start

```bash
docker compose up -d
docker compose logs gatelet  # grab the admin token
open http://localhost:4001
```

Docker is the only supported deployment method — it provides the filesystem and network isolation that the security model depends on.

## How It Works

```
┌─────────┐     MCP/HTTP      ┌──────────┐     Google API    ┌──────────────┐
│ AI Agent │ ───── :4000 ────▸ │ Gatelet  │ ───────────────▸ │ Google Cal   │
│          │  bearer token     │          │                   │              │
└─────────┘                    └──────────┘                   └──────────────┘
                                    │
                               :4001 Admin
                               (localhost only)
```

1. Agent connects to `:4000/mcp` with a bearer token (API key)
2. Agent sees only the MCP tools that the policy allows — denied tools are invisible
3. On each tool call, Gatelet evaluates the YAML policy: check constraints, apply mutations
4. If allowed, Gatelet calls the upstream API with (possibly mutated) parameters
5. Everything is audit-logged

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

**Constraints** validate input fields — reject if violated.
**Mutations** modify fields before sending upstream — the agent never knows.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GATELET_MCP_PORT` | `4000` | MCP server port (agent-facing) |
| `GATELET_ADMIN_PORT` | `4001` | Admin API port (human-facing) |
| `GATELET_DATA_DIR` | `~/.gatelet/data` | SQLite DB + master key location |
| `GATELET_ADMIN_TOKEN` | auto-generated | Admin dashboard token |
| `GOOGLE_CLIENT_ID` | built-in | Override Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | built-in | Override Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:4001/api/connections/oauth/google/callback` | OAuth redirect |

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
  admin/       Admin API (Hono on :4001) + dashboard
  db/          SQLite + encrypted credential storage
  mcp/         MCP server (raw HTTP on :4000)
  policy/      Policy engine (pure functions, no side effects)
  providers/   Provider implementations (Google Calendar)
  config.ts    Environment variable config
  index.ts     Entry point
```

## Security Model

- **Two trust domains:** Agent-facing (:4000) and admin-facing (:4001) are separate servers
- **Deny by default:** Operations not listed in a policy are denied
- **Hidden denied tools:** Agents never see tools they can't use
- **Defense in depth:** Dangerous operations (email send, delete) aren't implemented as code
- **Encrypted at rest:** OAuth credentials stored with XSalsa20-Poly1305 (libsodium)
- **HTTP transport only:** Gatelet is never a child process of the agent
- **Audit everything:** Every tool call is logged with params, result, and timing

## Docker

The `docker-compose.yml` uses two networks for isolation:

- **gatelet-internal** — Other containers (your agent) connect to Gatelet on `:4000`
- **gatelet-egress** — Allows Gatelet to reach external APIs

Admin port is bound to `127.0.0.1` only — not accessible from the network.

```bash
npm run docker:build   # Build production image
docker compose up -d   # Start with compose
```

## License

MIT
