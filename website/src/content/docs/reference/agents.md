---
title: Agent Setup
description: Configure MCP-compatible agents to use Gatelet
---

Gatelet works with any MCP-compatible agent. The admin dashboard generates the correct configuration snippet for each supported agent, or you can configure manually using the guides below.

## Supported agents

| Agent | Config file | Setup |
|---|---|---|
| OpenClaw | `./config/mcporter.json` | [Full guide](/reference/openclaw-setup/) |
| Claude Code | `~/.claude.json` | [Jump to section](#claude-code) |
| Gemini CLI | `~/.gemini/settings.json` | [Jump to section](#gemini-cli) |
| Codex | `~/.codex/config.toml` | [Jump to section](#codex) |

## OpenClaw

OpenClaw agents access MCP servers through the **mcporter** CLI skill. Agents can run unsandboxed on the host or inside Docker sandboxes — the setup differs depending on the mode.

See the [full OpenClaw setup guide](/reference/openclaw-setup/) for detailed instructions covering both modes.

**Quick reference** — the mcporter config at `./config/mcporter.json`:

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

:::note
If your agent runs in a Docker sandbox, the config goes at `~/.openclaw/workspace/config/mcporter.json` and the URL should use `host.docker.internal` instead of `localhost`. See the [full guide](/reference/openclaw-setup/#sandboxed-agents-docker) for details.
:::

## Claude Code

Claude Code stores MCP server configuration in `~/.claude.json`. You can add Gatelet via the CLI or by editing the file directly.

### Via CLI

```bash
claude mcp add --transport http gatelet http://localhost:4000/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

### Manual configuration

Add to `~/.claude.json` (merging with existing `mcpServers` if present):

```json
{
  "mcpServers": {
    "gatelet": {
      "type": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

After editing, restart Claude Code and verify with `claude mcp list` or the `/mcp` command inside a session.

:::tip
Claude Code also supports project-scoped config via `.mcp.json` in the project root (shared with your team) and user-scoped config in `~/.claude.json` (private, available across all projects). Use `--scope user` with the CLI to ensure the server is available everywhere.
:::

## Gemini CLI

Gemini CLI stores MCP configuration in `~/.gemini/settings.json`. For HTTP-based servers like Gatelet, use the `httpUrl` field.

Add to `~/.gemini/settings.json` (merging with existing `mcpServers` if present):

```json
{
  "mcpServers": {
    "gatelet": {
      "httpUrl": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Restart Gemini CLI after editing the settings file.

## Codex

Codex uses TOML configuration at `~/.codex/config.toml`. For remote HTTP servers, use the `url` and `http_headers` fields.

### Via CLI

```bash
codex mcp add gatelet --url http://localhost:4000/mcp
```

Then manually add the auth header to `~/.codex/config.toml`.

### Manual configuration

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.gatelet]
url = "http://localhost:4000/mcp"
http_headers = { "Authorization" = "Bearer YOUR_API_KEY" }
```

Verify with `codex mcp list`.

## Agent in Docker (same network as Gatelet)

If your agent runs in a container on the `gatelet-internal` Docker network (not the case for OpenClaw — see above), use Docker's internal DNS:

```json
{
  "mcpServers": {
    "gatelet": {
      "url": "http://gatelet:4000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## What the agent sees

Once configured, the agent sees only the tools allowed by your policies. For example, if you've connected a Google Calendar account with the default policy:

- `calendar_list_calendars` — visible
- `calendar_list_events` — visible
- `calendar_get_event` — visible
- `calendar_create_event` — hidden (disabled by default policy)
- `calendar_update_event` — hidden (disabled by default policy)
- `calendar_delete_event` — doesn't exist (not implemented in code)

The agent will naturally use the visible tools and has no awareness of hidden or unimplemented operations.

## Multiple connections

If you connect multiple accounts (e.g. both Google Calendar and Gmail), the agent sees all allowed tools from all connections in a single MCP endpoint. Tool names include the provider prefix to avoid collisions:

- `calendar_list_events` (Google Calendar)
- `outlook_list_events` (Outlook Calendar)
- `gmail_search` (Gmail)

:::note
If you connect two accounts of the same provider type (e.g., two Google Calendar accounts), their tool names will collide since both register tools like `calendar_list_events`. The first connection's tools are registered and the duplicate is skipped. To use multiple accounts, disable conflicting operations in one connection's policy so each tool name is unique.
:::

## API key management

Each API key provides access to all enabled connections and their allowed tools. You can create multiple API keys for different agents in the **API Keys** page.

API keys can be revoked at any time. Revoked keys are rejected immediately on the next request.
