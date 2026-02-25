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
| `GATELET_PASSPHRASE` | prompted | Encryption passphrase for credential storage |

### `GATELET_MCP_PORT`

The port the MCP server listens on. Your agent connects to this port. In Docker, this is typically not published to the host — other containers reach it via the internal Docker network.

### `GATELET_ADMIN_PORT`

The port the admin dashboard listens on. Bound to `127.0.0.1` in Docker so it's only accessible from the host machine.

### `GATELET_DATA_DIR`

The directory where Gatelet stores its SQLite database and encryption keys. In Docker, this maps to the `gatelet-data` volume at `/data`.

### `GATELET_ADMIN_TOKEN`

The token used to authenticate with the admin dashboard. If not set, Gatelet checks for a saved token at `$DATA_DIR/admin.token`. If neither exists, a random token is generated and saved.

### `GATELET_PASSPHRASE`

The passphrase used to derive the master encryption key via Argon2id. All OAuth credentials and secrets are encrypted at rest using this key.

If not set, Gatelet prompts interactively on startup. Set this for automated/Docker deployments.

## OAuth credentials

OAuth client credentials can be configured in two ways:

### Built-in credentials

Gatelet ships with built-in OAuth client IDs for Google and Microsoft. These work out of the box but show an "unverified app" warning during sign-in.

### Custom credentials

Register your own OAuth app with Google or Microsoft for a seamless sign-in experience. Configure credentials in the admin dashboard under **Settings > Integrations**.

You can also set them via environment variables:

| Variable | Provider |
|---|---|
| `GOOGLE_CLIENT_ID` | Google (Calendar + Gmail) |
| `GOOGLE_CLIENT_SECRET` | Google (Calendar + Gmail) |
| `MICROSOFT_CLIENT_ID` | Microsoft (Outlook Calendar) |
| `MICROSOFT_CLIENT_SECRET` | Microsoft (Outlook Calendar) |

Dashboard-configured credentials take precedence over environment variables.

## Data directory structure

```
~/.gatelet/data/
├── gatelet.db              # SQLite database
├── master.salt             # Argon2id salt for key derivation
├── master.key.verifier     # Encrypted verifier for passphrase check
└── admin.token             # Persisted admin token
```

### Database tables

| Table | Contents |
|---|---|
| `connections` | OAuth connections with encrypted credentials, policy YAML |
| `api_keys` | Hashed API keys (bcrypt) |
| `audit_log` | Tool call audit trail |
| `settings` | Encrypted global settings (OAuth credentials, TOTP secrets) |

## Rate limiting

Failed authentication attempts are rate-limited per IP:

- **Admin login:** 10 failed attempts per minute per IP
- **API key auth (MCP):** 10 failed attempts per minute per IP

The rate limiter tracks failures only — successful requests are not limited.
