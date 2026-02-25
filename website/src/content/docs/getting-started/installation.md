---
title: Installation
description: How to install and run Gatelet
---

Docker is the recommended deployment method — it provides the filesystem and network isolation the security model depends on.

## Quick start

The fastest way to get started:

```bash
npx gatelet@latest
```

This pulls the Docker image, generates an admin token, and starts Gatelet in `~/.gatelet`. The installer prints your admin token and dashboard URL when done.

## Install script

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
- Prompts for an encryption passphrase (8+ characters)
- Generates an admin token
- Starts the Gatelet container
- Sets up [Watchtower](https://containrrr.dev/watchtower/) for automatic updates

## Encryption passphrase

On first run, Gatelet prompts for an encryption passphrase (minimum 8 characters). This passphrase derives the master key used to encrypt all OAuth credentials and secrets at rest via Argon2id key derivation.

You'll need this passphrase every time the server starts. If you lose it, stored credentials cannot be recovered.

For automated/Docker deployments, set the `GATELET_PASSPHRASE` environment variable to skip the interactive prompt:

```bash
GATELET_PASSPHRASE=your-passphrase npx gatelet@latest
```

## Verify installation

Once installed, open the admin dashboard:

```bash
open http://localhost:4001
```

Paste the admin token that was printed during installation. If you've lost it, check `~/.gatelet/.env` for the `GATELET_ADMIN_TOKEN` value.

## Requirements

- **Docker** (recommended) — provides filesystem and network isolation
- **Node.js v22+** — only needed for development or running without Docker

## What's next

Follow the [First Setup](/getting-started/first-setup/) guide to connect your accounts and configure your agent.
