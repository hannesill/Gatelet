---
title: Security Model
description: Trust domains, encryption, audit logging, and defense-in-depth design
---

Gatelet's security model is built on defense in depth — multiple independent layers that each provide protection even if another layer is compromised.

## Two trust domains

Gatelet runs two separate HTTP servers on separate ports:

| Domain | Port | Audience | Access |
|---|---|---|---|
| **Agent-facing** | `:4000` | AI agents | Bearer token auth, Docker internal network |
| **Admin-facing** | `:4001` | Human operators | Admin token + optional TOTP 2FA, localhost only |

The admin port is published to `127.0.0.1` only in Docker Compose — it's not accessible from the network.

## Deny by default

Operations not listed in a policy are denied. The tool is never registered in MCP, so the agent doesn't know it exists.

This is fundamentally different from "access denied" responses:
- Access denied tells the agent the tool exists
- Hidden tools cannot be discovered, requested, or triggered via prompt injection
- The agent's LLM doesn't waste context on unavailable tools

## Defense in depth

Dangerous operations are protected by multiple independent mechanisms:

| Layer | Protection |
|---|---|
| **Code absence** | Delete operations are not implemented for any provider. There is no code path to execute them. |
| **Default policy** | Write operations (send, reply, create, update) are disabled by default |
| **Hidden tools** | Disabled operations are not registered in MCP |
| **Constraints** | Even when allowed, operations can be restricted by field values |
| **Mutations** | Fields can be silently stripped or overridden before upstream calls |
| **Field policies** | Only whitelisted fields are forwarded |
| **Content filters** | Email content is filtered for sensitive data before reaching the agent |

## Encryption

All credentials are encrypted at rest using libsodium:

- **Key derivation:** Argon2id (memory-hard, side-channel resistant) derives a 32-byte master key from the user's passphrase
- **Encryption:** XSalsa20-Poly1305 (authenticated encryption) with random nonces
- **Salt:** Generated per installation and stored at `$DATA_DIR/master.salt`
- **Verification:** An encrypted verifier at `$DATA_DIR/master.key.verifier` confirms the correct passphrase on startup

OAuth tokens, API secrets, TOTP secrets, and backup codes are all encrypted with this master key. The passphrase itself is never stored by Gatelet.

### Secret file storage

The install script stores the passphrase and admin token in a root-owned directory (`/usr/local/etc/gatelet/secrets/`) with `0600` permissions. These files are bind-mounted read-only into the container. This means:

- Reading the secrets requires `sudo` — regular users and compromised non-root processes cannot access them
- The secrets are never written to `.env` or other user-readable files
- The `_FILE` environment variable convention (`GATELET_PASSPHRASE_FILE`, `GATELET_ADMIN_TOKEN_FILE`) tells Gatelet to read secrets from file paths instead of env vars

**Note:** Users in the `docker` group can bypass file permissions by mounting any host file into a container. This is a known Docker limitation (docker group membership is effectively root-equivalent), not specific to Gatelet.

## Authentication

### Admin dashboard

- Token-based authentication (generated during installation)
- Optional TOTP two-factor authentication
- Session management with 24-hour TTL
- Rate limiting: 10 failed attempts per minute per IP

### MCP endpoint

- Bearer token authentication per API key
- API keys are hashed with bcrypt in the database
- Rate limiting: 10 failed attempts per minute per IP
- Last-used timestamp tracking

## HTTP transport only

Gatelet communicates with agents over HTTP, never stdio. This is a deliberate security choice:

- **No shared process space.** Gatelet is not a child process of the agent. They share no memory.
- **No filesystem access.** The agent cannot read Gatelet's encrypted database or credential files.
- **Network isolation.** Docker networks restrict which containers can reach each other.
- **Credential isolation.** OAuth tokens live in Gatelet's encrypted storage, never exposed to the agent process.

## Audit logging

Every tool call is logged with:

- Tool name and API key used
- Original parameters (as sent by the agent)
- Mutated parameters (after policy processing)
- Result (success or failure)
- Denial reason (if denied)
- Duration (milliseconds)
- Timestamp

The audit log is stored in SQLite and queryable through the admin dashboard with filters for tool name, result, and date range.

## Error sanitization

Upstream API errors are classified and sanitized before being returned to the agent. Internal details, stack traces, and credential information are never leaked. The agent receives a safe, categorized error message:

| Category | Description |
|---|---|
| `auth` | Authentication failure (expired token, revoked access) |
| `rate-limit` | Rate limited by upstream API |
| `not-found` | Resource not found |
| `permission` | Insufficient permissions upstream |
| `validation` | Invalid request parameters |

## Why not a CLI?

Many MCPs are thin API wrappers that would be better as CLIs. Gatelet is a security boundary, not a tool:

- **Network isolation is the point.** A CLI runs inside the agent's sandbox. Gatelet runs in its own container.
- **Tool visibility requires protocol-level control.** A CLI can only return errors after the fact, leaking what operations exist.
- **Credentials never touch the agent process.** OAuth tokens stay in Gatelet's encrypted database.
- **Transparent policy enforcement.** The agent calls a tool thinking it's talking to Gmail. Gatelet silently applies mutations, strips fields, and audits everything.
