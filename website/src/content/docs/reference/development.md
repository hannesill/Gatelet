---
title: Development
description: Local development setup, testing, and contribution guide
---

## Prerequisites

- Node.js v22+
- npm

## Setup

```bash
git clone https://github.com/hannesill/gatelet.git
cd gatelet
npm install
```

## Development server

```bash
npm run dev
```

This starts both the API and the dashboard (Vite dev server) with hot reload.

## Testing

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
```

The test suite includes 488 tests across 40 files covering:

- Admin API routes and authentication
- Database operations and encryption
- Policy engine (constraints, mutations, parsing)
- Provider implementations (Google Calendar, Outlook Calendar, Gmail)
- MCP server pipeline (tool registry, parameter filtering, error sanitization)
- Security edge cases (auth bypass, prototype pollution, rate limiting, audit integrity)
- Content filters (subject blocking, domain blocking, PII redaction)

## Building

```bash
npm run build        # Build dashboard + API (tsup → dist/)
npm start            # Run production build
```

## Docker

```bash
npm run docker:build
docker compose up -d
```

## Project structure

```
src/
  admin/       Admin API + routes (Hono on :4001)
  db/          SQLite + encrypted credential storage
  doctor/      Health checks
  mcp/         MCP server (Streamable HTTP on :4000)
  policy/      Policy engine (pure functions)
  providers/   Provider implementations
  config.ts    Environment configuration
  index.ts     Server entry point
  cli.ts       CLI entry point
dashboard/     React + Vite + Tailwind admin dashboard
website/       Astro + Starlight documentation site
tests/         Vitest test suite
```

## Architecture notes

- **Policy engine is pure functional** — no side effects, easy to test
- **Admin API uses Hono** — `createAdminApp()` is exported separately from `startAdminServer()` so tests can use `app.request()` without starting HTTP
- **Config uses getter/setter** — `config.ADMIN_TOKEN` is backed by a private `_adminToken` variable because vitest module caching can cause stale values across test files
- **Providers implement a common interface** — `Provider` with `execute()`, `refreshCredentials()`, tools array, and default policy
- **Database uses WAL mode** — better concurrent read performance for audit queries
