import { useState } from 'react';
import { useToast } from '../hooks/useToast';
import { Copy, Terminal, Pencil, ExternalLink } from 'lucide-react';

type Tool = 'openclaw' | 'claude-code' | 'gemini-cli' | 'codex';

const DOCS_BASE = 'https://gatelet.dev';

const TOOLS: { id: Tool; label: string; filePath: string; docsPath: string }[] = [
  { id: 'openclaw', label: 'OpenClaw', filePath: './config/mcporter.json', docsPath: '/reference/openclaw-setup/' },
  { id: 'claude-code', label: 'Claude Code', filePath: '~/.claude.json', docsPath: '/reference/agents/#claude-code' },
  { id: 'gemini-cli', label: 'Gemini CLI', filePath: '~/.gemini/settings.json', docsPath: '/reference/agents/#gemini-cli' },
  { id: 'codex', label: 'Codex', filePath: '~/.codex/config.toml', docsPath: '/reference/agents/#codex' },
];

const STORAGE_KEY = 'gatelet-agent-tab';

function getStoredTab(): Tool {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && TOOLS.some(t => t.id === v)) return v as Tool;
  } catch {}
  return 'openclaw';
}

function getDefaultUrl(_tool: Tool, _docker: boolean): string {
  return `http://${window.location.hostname}:4000/mcp`;
}

function buildConfig(tool: Tool, url: string, key: string): string {
  switch (tool) {
    case 'openclaw':
      return JSON.stringify({
        mcpServers: {
          gatelet: {
            description: 'Gatelet MCP proxy',
            baseUrl: url,
            headers: { Authorization: `Bearer ${key}` },
          },
        },
      }, null, 2);
    case 'claude-code':
      return JSON.stringify({
        mcpServers: {
          gatelet: {
            type: 'http',
            url,
            headers: { Authorization: `Bearer ${key}` },
          },
        },
      }, null, 2);
    case 'gemini-cli':
      return JSON.stringify({
        mcpServers: {
          gatelet: {
            httpUrl: url,
            headers: { Authorization: `Bearer ${key}` },
          },
        },
      }, null, 2);
    case 'codex':
      return [
        '[mcp_servers.gatelet]',
        `url = "${url}"`,
        `http_headers = { "Authorization" = "Bearer ${key}" }`,
      ].join('\n');
  }
}

export function AgentConfig({ apiKey, runtime }: { apiKey: string; runtime?: { docker: boolean } }) {
  const { toast } = useToast();
  const docker = runtime?.docker ?? false;
  const [mcpUrl, setMcpUrl] = useState(() => getDefaultUrl(getStoredTab(), docker));
  const [activeTool, setActiveTool] = useState<Tool>(getStoredTab);
  function selectTab(tool: Tool) {
    setActiveTool(tool);
    // Auto-switch URL when the current value matches a known default
    setMcpUrl(prev => {
      const oldDefault = getDefaultUrl(activeTool, docker);
      return prev === oldDefault ? getDefaultUrl(tool, docker) : prev;
    });
    try { localStorage.setItem(STORAGE_KEY, tool); } catch {}
  }

  const config = buildConfig(activeTool, mcpUrl, apiKey);
  const toolMeta = TOOLS.find(t => t.id === activeTool)!;
  const isToml = activeTool === 'codex';

  function copyConfig() {
    navigator.clipboard.writeText(config).then(() => toast('Config copied!'));
  }

  return (
    <div className="animate-in glass-dark overflow-hidden rounded-2xl shadow-2xl shadow-zinc-950/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-400" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">MCP Configuration</h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyConfig}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-indigo-500 active:scale-95"
          >
            <Copy className="h-3 w-3" />
            Copy {isToml ? 'TOML' : 'JSON'}
          </button>
        </div>
      </div>

      {/* MCP URL input */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-5 py-2.5">
        <Pencil className="h-3 w-3 shrink-0 text-zinc-500" />
        <label className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          MCP URL
        </label>
        <input
          type="text"
          value={mcpUrl}
          onChange={e => setMcpUrl(e.target.value)}
          className="flex-1 rounded-md border-0 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          spellCheck={false}
        />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/5 bg-white/[0.02]">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => selectTab(tool.id)}
            className={`relative px-4 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
              activeTool === tool.id
                ? 'text-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tool.label}
            {activeTool === tool.id && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500 transition-all" />
            )}
          </button>
        ))}
      </div>

      {/* Config file path hint + docs link */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-1.5">
        <span className="text-[10px] text-zinc-500">
          Config file: <code className="text-zinc-400">{toolMeta.filePath}</code>
        </span>
        <a
          href={`${DOCS_BASE}${toolMeta.docsPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-indigo-400 transition-colors hover:text-indigo-300"
        >
          Setup guide <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* Config snippet */}
      <pre className="overflow-x-auto p-6 font-mono text-xs leading-relaxed text-zinc-300 scrollbar-hide">
        {config}
      </pre>
    </div>
  );
}
