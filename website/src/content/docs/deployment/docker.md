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
│  127.0.0.1:4001 ─── Admin Dashboard            │
│  (localhost only)                               │
└─────────────────────────────────────────────────┘
```

### `gatelet-internal`

Other containers (your agent) connect to Gatelet on port `4000` via this network. The MCP port is **not** published to the host — only containers on the same Docker network can reach it.

### `gatelet-egress`

Allows Gatelet to reach external APIs (Google, Microsoft). This network provides outbound internet access.

### Admin port

The admin port (`4001`) is bound to `127.0.0.1` only — it's accessible from the host machine but not from the network or other machines.

## Docker Compose

The install script generates a `docker-compose.yml` in `~/.gatelet/`:

```yaml
services:
  gatelet:
    image: ghcr.io/hannesill/gatelet:latest
    ports:
      - "127.0.0.1:4001:4001"  # Admin — localhost only
    volumes:
      - gatelet-data:/data
    environment:
      - GATELET_DATA_DIR=/data
      - GATELET_ADMIN_TOKEN=${GATELET_ADMIN_TOKEN}
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
```

## Data volume

The `gatelet-data` volume persists:
- SQLite database (`gatelet.db`) — connections, API keys, audit log, settings
- Encryption salt (`master.salt`)
- Key verifier (`master.key.verifier`)
- Admin token (`admin.token`)

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

If your agent runs directly on the host (not in Docker), the MCP port needs to be published. Add a port binding:

```yaml
services:
  gatelet:
    ports:
      - "127.0.0.1:4001:4001"
      - "127.0.0.1:4000:4000"  # MCP — localhost only
```

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
