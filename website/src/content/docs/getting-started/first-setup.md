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
The built-in OAuth credentials are not yet verified by Google or Microsoft. You'll see an "unverified app" warning during sign-in — this is expected. Gatelet is fully self-hosted: all tokens are stored locally on your machine, encrypted at rest. The built-in credentials do not give the publisher any access to your data. To avoid the warning, [register your own OAuth app](/deployment/custom-oauth-apps/) and enter the credentials under **Settings > Integrations** in the dashboard.
:::

Each connection comes with a **default policy** that is intentionally restrictive. Read operations are typically allowed, while write operations (create, update, send) are disabled by default. You can edit the policy in the dashboard's policy editor.

## 4. Configure your agent

Navigate to **Setup** in the sidebar. The dashboard can install Gatelet's MCP config directly into your agent's configuration file.

Select your agent from the tabs in the MCP configurator. The dashboard generates the correct config snippet for each agent:

| Agent | Config file | Guide |
|---|---|---|
| OpenClaw | `./config/mcporter.json` | [Full guide](/reference/openclaw-setup/) |
| Claude Code | `~/.claude.json` | [Setup details](/reference/agents/#claude-code) |
| Gemini CLI | `~/.gemini/settings.json` | [Setup details](/reference/agents/#gemini-cli) |
| Codex | `~/.codex/config.toml` | [Setup details](/reference/agents/#codex) |

Copy the configuration snippet and paste it into the config file for your agent, or click **Install** to write it automatically.

:::note
OpenClaw requires additional setup beyond just the config file — see the [full OpenClaw setup guide](/reference/openclaw-setup/).
:::

## 5. Test the connection

Ask your agent to list your calendars or search your email. If everything is configured correctly, the agent will see only the tools allowed by your policies.

Check the **Audit Log** page in the dashboard to verify tool calls are flowing through Gatelet.

## Next steps

- [Policies](/concepts/policies/) — learn the YAML policy format
- [Constraints](/concepts/constraints/) — restrict field values
- [Mutations](/concepts/mutations/) — silently modify parameters
- [Content Filters](/concepts/content-filters/) — protect email content
