---
title: OpenClaw Setup
description: Connect OpenClaw agents to Gatelet via mcporter
---

OpenClaw agents access MCP servers through the **mcporter** CLI skill. This guide covers connecting an OpenClaw agent to Gatelet in both unsandboxed (host) and sandboxed (Docker) modes.

OpenClaw agents don't have native MCP support — they use **mcporter** (an OpenClaw skill, not a plugin) via the `exec` tool to call MCP servers.

## Prerequisites

- OpenClaw installed (`openclaw --version`)
- Gatelet running with a published port
- Node.js installed

## Common setup

These steps apply to both unsandboxed and sandboxed agents.

### Install mcporter globally

```bash
npm install -g mcporter
```

Verify the skill is ready:

```bash
openclaw skills info mcporter
# Should show: ✓ Ready
```

### Enable the mcporter skill

```bash
openclaw config set skills.entries.mcporter.enabled true
```

Or manually add to `~/.openclaw/openclaw.json` under `skills.entries`:

```json
"mcporter": { "enabled": true }
```

### Create the mcporter config

mcporter looks for a project-level config at `./config/mcporter.json` (relative to the working directory). Create it:

```bash
mkdir -p ./config
```

Create `./config/mcporter.json`:

```json
{
  "mcpServers": {
    "gatelet": {
      "description": "Gatelet MCP proxy",
      "baseUrl": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

You can override the config path with `mcporter --config /path/to/config.json`.

### Verify

```bash
mcporter config list
mcporter call gatelet.calendar_list_calendars
```

---

## Unsandboxed agents (host)

If your OpenClaw agent runs directly on the host (no Docker sandbox), the common setup above is all you need. mcporter is already on PATH and can reach Gatelet at `localhost`.

---

## Sandboxed agents (Docker)

If your agent runs inside a Docker sandbox, additional steps are needed to make mcporter and its config available inside the container.

### Architecture

```
Telegram/etc --> OpenClaw Gateway (:18789)
                      |
                      v
                Docker Sandbox (agent)
                      |
                      v
                mcporter CLI (exec tool)
                      |
                      v
                Gatelet MCP proxy (host.docker.internal:4000)
                      |
                      v
                Google Calendar, Gmail, etc.
```

### Additional prerequisites

- Docker running
- Node.js available in the sandbox Docker image

### Place config in the workspace

The sandbox container mounts `~/.openclaw/workspace` as `/workspace`. mcporter looks for a project-level config at `/workspace/config/mcporter.json` inside the container.

```bash
mkdir -p ~/.openclaw/workspace/config
```

Create `~/.openclaw/workspace/config/mcporter.json`:

```json
{
  "mcpServers": {
    "gatelet": {
      "description": "Gatelet MCP proxy",
      "baseUrl": "http://host.docker.internal:4000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

:::caution
Use `host.docker.internal` (not `localhost`) because the agent runs inside a Docker container and needs to reach the host network.

On Linux (where `host.docker.internal` may not work), use the Docker bridge gateway IP instead (usually `172.17.0.1`).
:::

### Copy mcporter into the workspace

Sandbox security blocks bind mounts from outside `~/.openclaw/workspace`. Copy the mcporter package into the workspace:

```bash
cp -r "$(npm root -g)/mcporter" ~/.openclaw/workspace/.mcporter-bin
```

### Configure the Docker sandbox

Add the following to `~/.openclaw/openclaw.json` under `agents.defaults.sandbox.docker`:

```json
{
  "binds": [
    "<WORKSPACE>/.mcporter-bin:/opt/mcporter:ro"
  ],
  "setupCommand": "mkdir -p /workspace/bin && ln -sf /opt/mcporter/dist/cli.js /workspace/bin/mcporter",
  "env": {
    "PATH": "/workspace/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  }
}
```

Replace `<WORKSPACE>` with your actual workspace path (e.g. `/Users/you/.openclaw/workspace` or `/home/you/.openclaw/workspace`).

**Why each piece:**
- `binds` — mounts the mcporter package read-only into `/opt/mcporter` inside the container
- `setupCommand` — creates a symlink so `mcporter` is on PATH (can't use `/usr/local/bin` because root fs is read-only; can't use `/tmp` because tmpfs wipes it)
- `env.PATH` — prepends `/workspace/bin` so the agent can find `mcporter`

### Recreate sandbox containers

Existing containers don't pick up new bind mounts. Recreate them:

```bash
openclaw sandbox recreate --all
```

New containers will be created automatically on next agent message.

### Verify from inside the sandbox

```bash
# Find the container
docker ps --filter "name=openclaw-sbx" --format "{{.Names}}"

# Verify mcporter works
docker exec <CONTAINER_NAME> /workspace/bin/mcporter config list

# Test a tool call
docker exec <CONTAINER_NAME> /workspace/bin/mcporter call \
  --http-url "http://host.docker.internal:4000/mcp" \
  --allow-http --name gatelet \
  calendar_list_calendars
```

Then message your bot and ask it to use mcporter to call gatelet tools.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `source is outside allowed roots` | Bind mount path not inside workspace | Copy files into `~/.openclaw/workspace/` |
| `Read-only file system` | Container root fs is read-only | Use `/workspace/bin` for symlinks, not `/usr/local/bin` |
| `No local servers match` | mcporter can't find config | Put config at `./config/mcporter.json` (host) or `<workspace>/config/mcporter.json` (sandbox) |
| `getaddrinfo ENOTFOUND gatelet` | Hostname not resolvable from container | Use `host.docker.internal:PORT` (macOS/Windows) or `172.17.0.1:PORT` (Linux) |
| `Not Acceptable` error | Server requires streamable-http Accept header | mcporter handles this automatically with `baseUrl` config |
| Symlink wiped after container start | Symlink was in `/tmp` (tmpfs) | Use `/workspace/bin` instead |
| `HOME=/` inside container | Container user has no home dir | Use project-level config at `/workspace/config/mcporter.json` |
| Agent doesn't know about mcporter | Skill not enabled or not installed | Run `npm install -g mcporter` + enable skill in config |

## Updating mcporter

When mcporter gets a new version:

```bash
npm update -g mcporter
```

If using sandboxed agents, also update the workspace copy:

```bash
cp -r "$(npm root -g)/mcporter" ~/.openclaw/workspace/.mcporter-bin
openclaw sandbox recreate --all
```

## Adding more MCP servers

Add entries to your `mcporter.json`:

```json
{
  "mcpServers": {
    "gatelet": {
      "description": "Gatelet MCP proxy",
      "baseUrl": "http://localhost:4000/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    },
    "another-server": {
      "description": "Another MCP server",
      "baseUrl": "https://mcp.example.com/mcp"
    }
  }
}
```

No restart needed — mcporter reads the config on each invocation.
