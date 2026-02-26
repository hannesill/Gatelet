---
title: Installation
description: How to install and run Gatelet
---

Docker is the recommended deployment method — it provides the filesystem and network isolation the security model depends on.

## Quick start

### macOS / Linux

```bash
curl -fsSL https://gatelet.dev/install.sh | sh
```

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy ByPass -Command "iex (iwr -UseBasicParsing https://gatelet.dev/install.ps1)"
```

The install script:
- Checks for Docker and Docker Compose
- Creates `~/.gatelet/` with a `docker-compose.yml`
- Generates an admin token (stored at a root-only-readable path)
- Starts the Gatelet container
- Sets up [Watchtower](https://containrrr.dev/watchtower/) for automatic updates

## Verify installation

Once installed, open the admin dashboard:

```bash
open http://localhost:4001
```

Paste the admin token that was printed during installation. If you've lost it, it's stored in the secrets directory (requires sudo on macOS/Linux):

```bash
sudo cat /usr/local/etc/gatelet/secrets/admin-token
```

## Requirements

- **Docker** (recommended) — provides filesystem and network isolation
- **Node.js v22+** — only needed for development or running without Docker

## What's next

Follow the [First Setup](/getting-started/first-setup/) guide to connect your accounts and configure your agent.
