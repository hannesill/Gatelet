import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

type ToolId = 'openclaw' | 'claude-code' | 'gemini-cli' | 'codex';

interface JsonToolDef {
  configPath: string;
  format: 'json';
  /** Build the server entry (inner object under mcpServers.gatelet) */
  buildEntry: (url: string, apiKey: string) => Record<string, unknown>;
  /** Top-level key that holds MCP servers */
  serversKey: string;
}

interface TomlToolDef {
  configPath: string;
  format: 'toml';
}

type ToolDef = JsonToolDef | TomlToolDef;

const TOOLS: Record<ToolId, ToolDef> = {
  openclaw: {
    configPath: '.openclaw/config.json',
    format: 'json',
    serversKey: 'mcpServers',
    buildEntry: (url, apiKey) => ({
      transport: 'streamable-http',
      url,
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  },
  'claude-code': {
    configPath: '.claude.json',
    format: 'json',
    serversKey: 'mcpServers',
    buildEntry: (url, apiKey) => ({
      type: 'http',
      url,
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  },
  'gemini-cli': {
    configPath: '.gemini/settings.json',
    format: 'json',
    serversKey: 'mcpServers',
    buildEntry: (url, apiKey) => ({
      httpUrl: url,
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  },
  codex: {
    configPath: '.codex/config.toml',
    format: 'toml',
  },
};

function isToolId(v: string): v is ToolId {
  return v in TOOLS;
}

/** Escape a value for use inside a TOML double-quoted string. */
function tomlEscape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Deep-merge gatelet entry into an existing JSON config file. */
function installJson(filePath: string, def: JsonToolDef, url: string, apiKey: string) {
  let config: Record<string, unknown> = {};
  if (fs.existsSync(filePath)) {
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      throw new Error(`Existing config at ${filePath} contains invalid JSON`);
    }
  }

  const servers = (config[def.serversKey] ?? {}) as Record<string, unknown>;
  servers['gatelet'] = def.buildEntry(url, apiKey);
  config[def.serversKey] = servers;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
}

/** Append or replace the [mcp_servers.gatelet] section in a TOML file. */
function installToml(filePath: string, url: string, apiKey: string) {
  const section =
    `[mcp_servers.gatelet]\n` +
    `url = "${tomlEscape(url)}"\n` +
    `http_headers = { "Authorization" = "Bearer ${tomlEscape(apiKey)}" }\n`;

  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  }

  // Replace existing section (up to the next [header] or EOF).
  // Preserve any blank line before the next section header.
  const sectionRe = /\[mcp_servers\.gatelet\]\n(?:[^\n\[]*\n)*/;
  if (sectionRe.test(content)) {
    content = content.replace(sectionRe, section);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    if (content) content += '\n';
    content += section;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

const app = new Hono();

app.post('/agent-config/install', async (c) => {
  const body = await c.req.json();
  const { tool, url, apiKey } = body as { tool?: string; url?: string; apiKey?: string };

  if (!tool || !url || !apiKey) {
    return c.json({ error: 'Missing required fields: tool, url, apiKey' }, 400);
  }
  if (!isToolId(tool)) {
    return c.json({ error: `Unknown tool: ${tool}` }, 400);
  }

  const def = TOOLS[tool];
  const filePath = path.join(os.homedir(), def.configPath);

  try {
    if (def.format === 'json') {
      installJson(filePath, def, url, apiKey);
    } else {
      installToml(filePath, url, apiKey);
    }
    return c.json({ installed: true, configPath: filePath });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

export default app;
