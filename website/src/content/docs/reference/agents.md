---
title: Agent Setup
description: Configure MCP-compatible agents to use Gatelet
---

Gatelet works with any MCP-compatible agent. The admin dashboard can auto-install the configuration for supported agents, or you can configure manually.

## Supported agents

The dashboard's **Setup** page can write Gatelet's MCP config directly into your agent's configuration file:

| Agent | Config file |
|---|---|
| OpenClaw | `~/.openclaw/config.json` |
| Claude Code | `~/.claude.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| Codex | `~/.codex/config.toml` |

Select your agent and click **Install** to write the config automatically.

## Manual configuration

For any MCP-compatible agent, you need to configure an MCP server entry pointing at Gatelet's endpoint with your API key as a bearer token.

### Agent in Docker (same network as Gatelet)

If your agent runs in a container on the `gatelet-internal` Docker network, use Docker's internal DNS:

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

### Agent on the host machine

If your agent runs directly on the host (not in Docker), you need to publish Gatelet's MCP port. Add this to your `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:4000:4000"
```

Then configure your agent to connect to localhost:

```json
{
  "mcpServers": {
    "gatelet": {
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Codex (TOML)

Codex uses TOML configuration. Add to `~/.codex/config.toml`:

```toml
[mcp_servers.gatelet]
url = "http://localhost:4000/mcp"
http_headers = { "Authorization" = "Bearer YOUR_API_KEY" }
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

:::note
Each agent expects a slightly different MCP config format. The dashboard's **Setup** page handles this automatically. If configuring manually, refer to your agent's documentation for the exact format.
:::

## API key management

Each API key provides access to all enabled connections and their allowed tools. You can create multiple API keys for different agents in the **API Keys** page.

API keys can be revoked at any time. Revoked keys are rejected immediately on the next request.
