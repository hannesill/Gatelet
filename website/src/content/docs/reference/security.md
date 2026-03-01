---
title: Security Model
description: Trust domains, encryption, audit logging, and defense-in-depth design
---

Gatelet's security model is built on defense in depth — multiple independent layers that each provide protection even if another layer is compromised.

## Two trust domains

Gatelet runs two separate HTTP servers on separate ports:

| Domain | Port | Audience | Access |
|---|---|---|---|
| **Agent-facing** | `:4000` | AI agents | Bearer token auth |
| **Admin-facing** | `:4001` | Human operators | Admin token, localhost only |

Both ports bind to `127.0.0.1` — they are not accessible from the network.

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

- **Key derivation:** HKDF-SHA256 derives a 32-byte master key from the admin token
- **Encryption:** XSalsa20-Poly1305 (authenticated encryption) with random nonces

OAuth tokens and API secrets are all encrypted with this master key.

### Admin token storage

The admin token serves double duty: it authenticates admin dashboard access and derives the master encryption key via HKDF-SHA256.

**Native host install (recommended):** The admin token is stored at `/var/lib/gatelet/admin.token`, owned by the Gatelet service user with mode `600`. The entire data directory is mode `700`. Reading the token requires `sudo` or being the service user — regular users and agent processes cannot access it.

**Docker install:** The token is stored in a root-owned directory (`/usr/local/etc/gatelet/secrets/`) on the host, then seeded into a Docker volume mounted into the container. On the host, reading requires `sudo`. However, any process with Docker CLI access can read it via `docker exec` — see [Agent isolation](#agent-isolation) below.

In both modes:
- The token is never written to `.env` or other user-readable files
- The admin token is masked in startup logs — agents can read `docker logs` or system logs without sudo, so the full token is never printed to stdout in service deployments
- The `GATELET_ADMIN_TOKEN_FILE` environment variable tells Gatelet to read the token from a file path instead of an env var

### Agent isolation

The level of protection depends on both the deployment method and the agent type:

#### Native host deployment

| Scenario | Can read admin token? | Protected? |
|---|---|---|
| **Any host agent (normal user)** | No — wrong user, directory mode 700 | Yes |
| **Host agent with `sudo`** | Yes | No — `sudo` is root-equivalent |

The native host install provides the strongest isolation. The Gatelet data directory is owned by a dedicated system user and restricted to mode `700`. No matter how the agent runs — sandboxed, unsandboxed, with Docker CLI, with Bash — it cannot read the admin token unless it has `sudo`.

#### Docker deployment

| Scenario | Can read admin token? | Protected? |
|---|---|---|
| **Docker-sandboxed agent** | No — port 4001 not on internal network | Yes |
| **Host agent without Docker CLI** | No — root-owned token file | Yes |
| **Host agent with Docker CLI** | Yes — `docker exec` reads secrets | No |
| **Host agent with `sudo`** | Yes | No |

:::caution
Most unsandboxed agents (Claude Code, Cursor, any agent with Bash access) have Docker CLI access. This means Docker provides **no protection** in the most common deployment scenario. Use the [native host install](/deployment/native-host/) for these environments.
:::

## Authentication

### Admin dashboard

- Token-based authentication (generated during installation)
- Session management with 24-hour TTL
- Rate limiting: 10 failed attempts per minute per IP

### MCP endpoint

- Bearer token authentication per API key
- API keys are hashed with SHA-256 in the database
- Sessions are bound to the API key that created them — a different key cannot reuse an existing session
- 20 session cap with LRU eviction; idle sessions expire after 48 hours
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

- API key ID (identifies which agent made the call)
- Tool name
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

- **Network isolation is the point.** A CLI runs inside the agent's sandbox. Gatelet runs as a separate service.
- **Tool visibility requires protocol-level control.** A CLI can only return errors after the fact, leaking what operations exist.
- **Credentials never touch the agent process.** OAuth tokens stay in Gatelet's encrypted database.
- **Transparent policy enforcement.** The agent calls a tool thinking it's talking to Gmail. Gatelet silently applies mutations, strips fields, and audits everything.
