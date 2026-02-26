---
title: First Setup
description: Connect accounts, create API keys, and configure your agent
---

After [installation](/getting-started/installation/), you'll walk through three steps in the admin dashboard: generate an API key, connect your accounts, and point your agent at Gatelet.

## 1. Log in to the dashboard

Open `http://localhost:4001` and enter the admin token that was printed during installation. You can retrieve it with `sudo cat /usr/local/etc/gatelet/secrets/admin-token` if needed.

## 2. Generate an API key

Navigate to **API Keys** in the sidebar. Click **Generate Key** and give it a descriptive name (e.g. "openclaw-agent").

Copy the key — it won't be shown again. This is the bearer token your agent will use to authenticate with the MCP endpoint.

## 3. Connect an account

Navigate to **Connections** and click **Add Connection**. Choose a provider (Google Calendar, Outlook Calendar, or Gmail) and click the OAuth button.

You'll be redirected to Google or Microsoft to authorize access. After granting permission, you'll return to the dashboard with the connection active.

:::note
The built-in OAuth credentials are not yet verified by Google or Microsoft. You'll see an "unverified app" warning during sign-in — this is expected. Gatelet is fully self-hosted: all tokens are stored locally on your machine, encrypted at rest. The built-in credentials do not give the publisher any access to your data. To avoid the warning, register your own OAuth app under **Settings > Integrations** in the dashboard.
:::

Each connection comes with a **default policy** that is intentionally restrictive. Read operations are typically allowed, while write operations (create, update, send) are disabled by default. You can edit the policy in the dashboard's policy editor.

## 4. Configure your agent

Navigate to **Setup** in the sidebar. The dashboard can install Gatelet's MCP config directly into your agent's configuration file.

Select your agent from the dropdown:

| Agent | Config file |
|---|---|
| OpenClaw | `~/.openclaw/config.json` |
| Claude Code | `~/.claude.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| Codex | `~/.codex/config.toml` |

Click **Install** to write the MCP config automatically, or copy the configuration manually.

### Manual configuration

For any MCP-compatible agent, point it at the Gatelet MCP endpoint with your API key:

**Docker network** (agent runs in a container on the same Docker network):
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

**Localhost** (agent runs directly on the host):
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

## 5. Test the connection

Ask your agent to list your calendars or search your email. If everything is configured correctly, the agent will see only the tools allowed by your policies.

Check the **Audit Log** page in the dashboard to verify tool calls are flowing through Gatelet.

## Next steps

- [Policies](/concepts/policies/) — learn the YAML policy format
- [Constraints](/concepts/constraints/) — restrict field values
- [Mutations](/concepts/mutations/) — silently modify parameters
- [Content Filters](/concepts/content-filters/) — protect email content
