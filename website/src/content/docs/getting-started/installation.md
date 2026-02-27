---
title: Installation
description: How to install and run Gatelet
---

## macOS / Linux (recommended)

The native host install runs Gatelet as a dedicated system service with OS-level agent isolation.

```bash
curl -fsSL https://gatelet.dev/install-host.sh | bash
```

The install script:
- Checks for Node.js 22+
- Creates a system user (`_gatelet` on macOS, `gatelet` on Linux)
- Installs Gatelet to `/usr/local/lib/gatelet/`
- Creates a data directory at `/var/lib/gatelet/` (mode 700, owned by the service user)
- Generates an admin token
- Installs and starts a system service (launchd on macOS, systemd on Linux)

**Why this is recommended:** The admin token, database, and stored credentials live in a directory that only the Gatelet service user can read. Your agent (running as your normal user) cannot access them — Unix file permissions enforce this.

### Retrieve the admin token

```bash
sudo cat /var/lib/gatelet/admin.token
```

## Windows (Docker)

```powershell
powershell -ExecutionPolicy ByPass -Command "iex (iwr -UseBasicParsing https://gatelet.dev/install.ps1)"
```

The Windows installer uses Docker, which is the only supported deployment method on Windows.

## Docker (alternative for macOS / Linux)

```bash
curl -fsSL https://gatelet.dev/install.sh | sh
```

Docker works well for agents that run inside Docker containers (sandboxed). However, agents with host access (like Claude Code, Cursor, or any agent with Bash) can use `docker exec` to read secrets from inside the container. For these environments, use the native host install instead.

## Verify installation

Once installed, open the admin dashboard:

```bash
open http://localhost:4001
```

Paste the admin token that was printed during installation (or retrieve it with `sudo cat`).

## Requirements

| Method | Requirements |
|---|---|
| **Native host** (macOS / Linux) | Node.js 22+, sudo access |
| **Docker** (Windows / alternative) | Docker, Docker Compose |

## What's next

Follow the [First Setup](/getting-started/first-setup/) guide to connect your accounts and configure your agent.
