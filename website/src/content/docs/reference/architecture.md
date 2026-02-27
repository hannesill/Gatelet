---
title: Architecture
description: System architecture, request pipeline, and project structure
---

## System overview

![Gatelet System Architecture](/gatelet-architecture.png)

### Agent Tier

The MCP server on port 4000. Implements the [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) from the MCP SDK. Per-session `McpServer` instances ensure the tool registry is fresh for each connection.

### Proxy Tier

The policy engine, credential management, and audit logging. This is the core of Gatelet. It evaluates policies, applies constraints and mutations, manages encrypted OAuth tokens, and logs every operation.

### Upstream Tier

Google and Microsoft APIs. Gatelet holds the OAuth credentials and makes API calls on behalf of the agent.

## Request pipeline

When the agent calls a tool:

```
1. Authenticate  ─▸  Validate bearer token (API key)
2. Resolve       ─▸  Find connection + provider for this tool
3. Parse policy  ─▸  Load YAML policy from database
4. Evaluate      ─▸  Check constraints → apply mutations
5. Strip params  ─▸  Remove fields not in tool's input schema
6. Field policy  ─▸  Apply allowed_fields / denied_fields
7. Execute       ─▸  Call provider (upstream API)
8. Filter        ─▸  Apply content filters (email providers)
9. Audit         ─▸  Log API key, original params, mutated params, result, timing
10. Respond      ─▸  Return sanitized result to agent
```

If any step fails (auth, constraints, provider error), the pipeline short-circuits and returns a safe error message. Upstream errors are classified and sanitized — no internal details are leaked.

## Session management

The MCP server creates a new `McpServer` instance per session. Sessions have:

- **API key binding** — each session is bound to the API key that created it; requests with a different key are rejected
- **30-minute TTL** — inactive sessions are cleaned up and transport resources are released
- **100 session cap** — oldest sessions are evicted when the cap is reached
- **Fresh tool registry** — each session rebuilds the tool list from current policies

This ensures policy changes take effect on the next agent connection without restarting the server.

## Project structure

```
src/
  admin/       Admin API + routes (Hono on :4001)
  db/          SQLite + encrypted credential storage (libsodium)
  doctor/      Health checks (CLI + admin API)
  mcp/         MCP server (raw HTTP on :4000, Streamable HTTP transport)
  policy/      Policy engine (pure functions, no side effects)
  providers/   Provider implementations
    google-calendar/    Google Calendar via googleapis
    outlook-calendar/   Outlook Calendar via Microsoft Graph
    gmail/              Gmail via googleapis
    outlook-mail/       Outlook Mail via Microsoft Graph
    google/             Shared Google OAuth helpers
    microsoft/          Shared Microsoft Graph helpers
    email/              Shared email types, content filters, HTML stripping
  config.ts    Environment variable config
  index.ts     Entry point
  cli.ts       CLI entry point (gatelet, gatelet doctor)
dashboard/     Admin dashboard (React, Vite, Tailwind)
website/       Documentation site (Astro, Starlight)
tests/         Test suite (vitest, 590 tests)
```

## Key modules

### Policy engine (`src/policy/`)

Pure functional, no side effects. The engine receives a policy config, operation name, and parameters, and returns either a denial or the mutated parameters.

- `engine.ts` — orchestrates constraints → mutations → result
- `constraints.ts` — evaluates the four constraint rules
- `mutations.ts` — applies set/delete mutations
- `parser.ts` — YAML parsing with validation
- `field-path.ts` — dot-notation field access for nested paths

### MCP server (`src/mcp/`)

Raw HTTP server using the MCP SDK's `StreamableHTTPServerTransport`. Handles:

- Bearer token authentication with rate limiting
- Per-session tool registration
- Request size limits (1MB)
- Error sanitization

### Admin API (`src/admin/`)

Hono framework with 8 route modules:

- Connections (OAuth flow, CRUD)
- Policies (YAML management)
- API keys (generate, list, revoke)
- Audit log (query with filters)
- Settings (OAuth credentials)
- Status (health + metrics)
- Providers (list all available tools)
- Doctor (health checks)

### Database (`src/db/`)

SQLite with WAL mode and foreign key constraints. All credentials are encrypted with libsodium before storage. The database module handles schema migrations automatically on startup.

## Token refresh

If an upstream API call fails due to an expired OAuth token, Gatelet automatically refreshes the token and retries the request. Per-connection mutex prevents concurrent refresh races. No agent or user action is required.
