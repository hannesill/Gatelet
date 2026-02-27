---
title: Docker
description: Docker deployment, network isolation, and container architecture
---

Docker is the recommended deployment method. It provides the filesystem and network isolation that Gatelet's security model depends on.

## Network architecture

The `docker-compose.yml` uses two networks for isolation:

```
┌─────────────────────────────────────────────────┐
│                Docker Host                      │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │          gatelet-internal                │    │
│  │                                         │    │
│  │  ┌───────────┐      ┌──────────┐       │    │
│  │  │ AI Agent  │─:4000─│ Gatelet │       │    │
│  │  │ container │       │         │       │    │
│  │  └───────────┘       └────┬────┘       │    │
│  │                           │             │    │
│  └───────────────────────────┼─────────────┘    │
│                              │                   │
│  ┌───────────────────────────┼─────────────┐    │
│  │          gatelet-egress   │             │    │
│  │                           │             │    │
│  │                    Google / Microsoft    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  127.0.0.1:4000 ─── MCP endpoint               │
│  127.0.0.1:4001 ─── Admin Dashboard            │
│  (localhost only)                               │
└─────────────────────────────────────────────────┘
```

### `gatelet-internal`

Other containers (your agent) connect to Gatelet on port `4000` via this network using Docker's internal DNS (`http://gatelet:4000/mcp`).

### `gatelet-egress`

Allows Gatelet to reach external APIs (Google, Microsoft). This network provides outbound internet access.

### Ports

Both ports are bound to `127.0.0.1` — accessible from the host machine but not from the network or other machines. The MCP port (`4000`) is protected by API key authentication; the admin port (`4001`) is protected by the admin token.

## Docker Compose

The install script generates a `docker-compose.yml` in `~/.gatelet/`. It uses `GATELET_ADMIN_TOKEN_FILE` with a secrets volume so the token is never exposed as an environment variable:

```yaml
services:
  gatelet:
    image: ghcr.io/hannesill/gatelet:latest
    ports:
      - "127.0.0.1:4000:4000"  # MCP — localhost only
      - "127.0.0.1:4001:4001"  # Admin — localhost only
    volumes:
      - gatelet-data:/data
      - gatelet-secrets:/run/secrets/gatelet:ro
    environment:
      - GATELET_DATA_DIR=/data
      - GATELET_ADMIN_TOKEN_FILE=/run/secrets/gatelet/admin-token
    networks:
      - gatelet-internal
      - gatelet-egress
    restart: unless-stopped

networks:
  gatelet-internal:
    driver: bridge
  gatelet-egress:
    driver: bridge

volumes:
  gatelet-data:
  gatelet-secrets:
    external: true
```

:::note[Simplified dev config]
For local development without Docker secrets, you can pass the token directly as an environment variable instead:

```yaml
environment:
  - GATELET_DATA_DIR=/data
  - GATELET_ADMIN_TOKEN=your-dev-token
```

This is less secure — the token is visible in `docker inspect` and process listings. Use `GATELET_ADMIN_TOKEN_FILE` for production.
:::

## Data volume

The `gatelet-data` volume persists:
- SQLite database (`gatelet.db`) — connections, API keys, audit log, settings

The data volume is preserved across updates and container recreations.

## Connecting your agent

If your agent runs in a Docker container, add it to the `gatelet-internal` network:

```yaml
services:
  my-agent:
    image: my-agent:latest
    networks:
      - gatelet-internal
    environment:
      - MCP_URL=http://gatelet:4000/mcp
```

The agent reaches Gatelet at `http://gatelet:4000/mcp` using Docker's internal DNS.

Agents running on the host (like Claude Code or Gemini CLI) connect via `http://localhost:4000/mcp` instead.

## Building from source

```bash
npm run docker:build
docker compose up -d
```

## Health check

The Docker image includes a health check that pings the admin server. Check container health with:

```bash
docker compose ps
```
