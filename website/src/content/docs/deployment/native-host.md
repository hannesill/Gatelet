---
title: Native Host
description: Native host deployment with OS-level agent isolation
---

The native host install is the recommended deployment method for macOS and Linux. It runs Gatelet as a system service under a dedicated OS user, providing genuine agent isolation through Unix file permissions.

## Security model

```
Agent (your user)          Gatelet (_gatelet user)
─────────────────          ──────────────────────
Can reach localhost:4000   Owns /var/lib/gatelet/ (mode 700)
Can reach localhost:4001   Stores admin token, DB, credentials
Cannot read /var/lib/gatelet/ ← Unix permissions block access
Cannot authenticate on :4001  ← No admin token
```

The agent can only interact with the MCP endpoint on port 4000, which requires an API key and enforces configured policies. The admin port (4001) is reachable but useless without the token.

## Directory layout

| Path | Owner | Mode | Contents |
|---|---|---|---|
| `/usr/local/lib/gatelet/` | root | read-only | Application files (`dist/`, `node_modules/`) |
| `/var/lib/gatelet/` | `_gatelet` / `gatelet` | 700 | Database, admin token, credentials |
| `/var/lib/gatelet/admin.token` | `_gatelet` / `gatelet` | 600 | Admin authentication token |
| `/var/lib/gatelet/gatelet.db` | `_gatelet` / `gatelet` | 600 | SQLite database |

## Service management

### macOS (launchd)

```bash
# Status
sudo launchctl print system/dev.gatelet

# Logs
cat /var/lib/gatelet/gatelet.log

# Stop / Start
sudo launchctl bootout system/dev.gatelet
sudo launchctl bootstrap system /Library/LaunchDaemons/dev.gatelet.plist

# Uninstall
sudo launchctl bootout system/dev.gatelet
sudo rm /Library/LaunchDaemons/dev.gatelet.plist
```

### Linux (systemd)

```bash
# Status
sudo systemctl status gatelet

# Logs
sudo journalctl -u gatelet -f

# Stop / Start
sudo systemctl stop gatelet
sudo systemctl start gatelet

# Uninstall
sudo systemctl disable --now gatelet
sudo rm /etc/systemd/system/gatelet.service
```

## Retrieving the admin token

```bash
sudo cat /var/lib/gatelet/admin.token
```

The token is only readable by root and the Gatelet service user. Your agent cannot read it.

## Updating

Re-run the install script. It preserves your existing data directory and admin token:

```bash
curl -fsSL https://gatelet.dev/install-host.sh | bash
```

## Environment variables

The install script configures these via the service file:

| Variable | Value |
|---|---|
| `GATELET_DATA_DIR` | `/var/lib/gatelet` |
| `GATELET_ADMIN_TOKEN_FILE` | `/var/lib/gatelet/admin.token` |
| `NODE_ENV` | `production` |

To customize ports, edit the service file directly:
- macOS: `/Library/LaunchDaemons/dev.gatelet.plist`
- Linux: `/etc/systemd/system/gatelet.service`

## Systemd security hardening (Linux)

The systemd unit includes security directives:

| Directive | Effect |
|---|---|
| `NoNewPrivileges=true` | Process cannot gain new privileges |
| `ProtectSystem=strict` | Filesystem is read-only except allowed paths |
| `ProtectHome=true` | `/home` is inaccessible |
| `ReadWritePaths=/var/lib/gatelet` | Only the data directory is writable |
| `PrivateTmp=true` | Isolated `/tmp` |

## Troubleshooting

### "Session not found" after restarting Gatelet

Gatelet holds up to 20 MCP sessions in memory. When the service restarts, all sessions are lost. Connected agents will receive a "Session not found" error on their next request.

Most MCP clients should automatically re-initialize a new session when this happens (the MCP spec requires clients to handle HTTP 404 this way), but some clients — including Claude Code at the time of writing — surface the error instead. If this happens, restart your agent or reconnect the MCP server from your client.

## Local build install

To install from a local build instead of downloading:

```bash
npm run build
GATELET_LOCAL=1 bash install-host.sh
```
