---
title: Configuration
description: Environment variables, data directory, and OAuth credentials
---

Gatelet is configured through environment variables and the admin dashboard.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GATELET_MCP_PORT` | `4000` | MCP server port (agent-facing) |
| `GATELET_ADMIN_PORT` | `4001` | Admin API port (human-facing) |
| `GATELET_DATA_DIR` | `~/.gatelet/data` | SQLite DB + encryption keys location |
| `GATELET_ADMIN_TOKEN` | auto-generated | Admin dashboard authentication token |
| `GATELET_ADMIN_TOKEN_FILE` | — | Path to file containing admin token (Docker secrets) |
| `GATELET_TRUST_PROXY` | — | Trust `X-Forwarded-For` for client IP extraction |

### `GATELET_MCP_PORT`

The port the MCP server listens on. Your agent connects to this port. In Docker, this is typically not published to the host — other containers reach it via the internal Docker network.

### `GATELET_ADMIN_PORT`

The port the admin dashboard listens on. Bound to `127.0.0.1` in Docker so it's only accessible from the host machine.

### `GATELET_DATA_DIR`

The directory where Gatelet stores its SQLite database and encryption keys. In Docker, this maps to the `gatelet-data` volume at `/data`.

### `GATELET_ADMIN_TOKEN`

The token used to authenticate with the admin dashboard and to derive the master encryption key via HKDF-SHA256. All OAuth credentials and secrets are encrypted at rest using this derived key.

If not set, Gatelet checks for a saved token at `$DATA_DIR/admin.token`. If neither exists, a random token is generated and saved.

### Secret file convention (`_FILE`)

`GATELET_ADMIN_TOKEN` supports the `_FILE` suffix convention used by Docker secrets. When `GATELET_ADMIN_TOKEN_FILE` is set, Gatelet reads the token from that file path instead of the environment variable. The `_FILE` variant takes precedence over the direct env var.

The default install script uses this approach: the admin token is stored on the host at `/usr/local/etc/gatelet/secrets/` with root-only permissions (`0600`), then seeded into a Docker volume (`gatelet-secrets`) mounted read-only into the container:

```yaml
volumes:
  - gatelet-secrets:/run/secrets/gatelet:ro
environment:
  - GATELET_ADMIN_TOKEN_FILE=/run/secrets/gatelet/admin-token
```

Reading the token on the host requires `sudo` — regular users and agent processes cannot access it.

### `GATELET_TRUST_PROXY`

When Gatelet runs behind a reverse proxy (e.g., nginx, Caddy, Cloudflare Tunnel), set this to any value to trust the `X-Forwarded-For` header for client IP extraction. Without it, rate limiting sees the proxy's IP for all requests, which means a single attacker can lock out all users — or a single proxy IP hits the limit for everyone.

```yaml
environment:
  - GATELET_TRUST_PROXY=1
```

Only enable this when Gatelet is actually behind a trusted reverse proxy. If enabled without a proxy, clients can spoof their IP via the `X-Forwarded-For` header to bypass rate limiting.

## OAuth credentials

OAuth client credentials can be configured in two ways:

### Built-in credentials

Gatelet ships with built-in OAuth client IDs for Google and Microsoft. These work out of the box but show an "unverified app" warning during sign-in. Google uses an "installed app" OAuth flow where the client secret is non-confidential by design. Microsoft uses PKCE (no client secret required).

### Custom credentials

Register your own OAuth app with Google or Microsoft for a seamless sign-in experience. Configure credentials in the admin dashboard under **Settings > Integrations**.

You can also set them via environment variables:

| Variable | Provider |
|---|---|
| `GOOGLE_CLIENT_ID` | Google (Calendar + Gmail) |
| `GOOGLE_CLIENT_SECRET` | Google (Calendar + Gmail) |
| `MICROSOFT_CLIENT_ID` | Microsoft (Outlook Calendar) |
| `MICROSOFT_CLIENT_SECRET` | Microsoft (Outlook Calendar) — optional, only needed for confidential client registrations |

Dashboard-configured credentials take precedence over environment variables.

## Data directory structure

**Docker deployment** (install script):
```
gatelet-data volume (/data inside container):
└── gatelet.db              # SQLite database

gatelet-secrets volume (/run/secrets/gatelet, read-only):
└── admin-token             # Admin token (seeded from host)
```

**Local development** (no Docker):
```
~/.gatelet/data/
├── gatelet.db              # SQLite database
└── admin.token             # Auto-generated admin token (0600)
```

### Database tables

| Table | Contents |
|---|---|
| `connections` | OAuth connections with encrypted credentials, policy YAML |
| `api_keys` | Hashed API keys (SHA-256) |
| `audit_log` | Tool call audit trail |
| `settings` | Encrypted global settings (OAuth credentials) |

## Health check endpoint

The admin server exposes a public (unauthenticated) health check:

```
GET http://localhost:4001/api/health
```

Returns `{"status":"ok"}`. Useful for monitoring and load balancer health checks.

## Rate limiting

Failed authentication attempts are rate-limited per IP:

- **Admin login:** 10 failed attempts per minute per IP
- **API key auth (MCP):** 10 failed attempts per minute per IP

The rate limiter tracks failures only — successful requests are not limited.
