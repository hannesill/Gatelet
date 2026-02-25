import { useState } from 'react';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { Copy, Terminal, CheckCircle2, Pencil, Download, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

type Tool = 'openclaw' | 'claude-code' | 'gemini-cli' | 'codex';

const TOOLS: { id: Tool; label: string; filePath: string }[] = [
  { id: 'openclaw', label: 'OpenClaw', filePath: '~/.openclaw/config.json' },
  { id: 'claude-code', label: 'Claude Code', filePath: '~/.claude.json' },
  { id: 'gemini-cli', label: 'Gemini CLI', filePath: '~/.gemini/settings.json' },
  { id: 'codex', label: 'Codex', filePath: '~/.codex/config.toml' },
];

const STORAGE_KEY = 'gatelet-agent-tab';

function getStoredTab(): Tool {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && TOOLS.some(t => t.id === v)) return v as Tool;
  } catch {}
  return 'openclaw';
}

function buildConfig(tool: Tool, url: string, key: string): string {
  switch (tool) {
    case 'openclaw':
      return JSON.stringify({
        mcpServers: {
          gatelet: {
            transport: 'streamable-http',
            url,
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

export function AgentConfig({ apiKey }: { apiKey: string }) {
  const { toast } = useToast();
  const [mcpUrl, setMcpUrl] = useState(
    `http://${window.location.hostname}:4000/mcp`,
  );
  const [activeTool, setActiveTool] = useState<Tool>(getStoredTab);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ ok: boolean; message: string } | null>(null);

  function selectTab(tool: Tool) {
    setActiveTool(tool);
    setInstallResult(null);
    try { localStorage.setItem(STORAGE_KEY, tool); } catch {}
  }

  const config = buildConfig(activeTool, mcpUrl, apiKey);
  const toolMeta = TOOLS.find(t => t.id === activeTool)!;
  const isToml = activeTool === 'codex';

  function copyConfig() {
    navigator.clipboard.writeText(config).then(() => toast('Config copied!'));
  }

  async function install() {
    setInstalling(true);
    setInstallResult(null);
    try {
      const res = await api.installAgentConfig(activeTool, mcpUrl, apiKey);
      setInstallResult({ ok: true, message: `Written to ${res.configPath}` });
      toast('Config installed!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setInstallResult({ ok: false, message: msg });
    } finally {
      setInstalling(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-dark overflow-hidden rounded-2xl shadow-2xl shadow-zinc-950/20"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-400" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">MCP Configuration</h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyConfig}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold text-zinc-300 ring-1 ring-white/10 transition-all hover:bg-white/10 active:scale-95"
          >
            <Copy className="h-3 w-3" />
            Copy {isToml ? 'TOML' : 'JSON'}
          </button>
          <button
            onClick={install}
            disabled={installing}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-60"
          >
            {installing
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Download className="h-3 w-3" />}
            Add to Config
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
              <motion.div
                layoutId="agent-tab-indicator"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Config file path hint */}
      <div className="border-b border-white/5 bg-white/[0.02] px-5 py-1.5">
        <span className="text-[10px] text-zinc-500">
          Config file: <code className="text-zinc-400">{toolMeta.filePath}</code>
        </span>
      </div>

      {/* Config snippet */}
      <div className="relative">
        <pre className="overflow-x-auto p-6 font-mono text-xs leading-relaxed text-zinc-300 scrollbar-hide">
          {config}
        </pre>
        {!installResult && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Ready to use
          </div>
        )}
      </div>

      {/* Install result feedback */}
      {installResult && (
        <div className={`flex items-center gap-2 border-t border-white/5 px-5 py-2.5 text-[11px] font-medium ${
          installResult.ok
            ? 'bg-emerald-500/5 text-emerald-400'
            : 'bg-red-500/5 text-red-400'
        }`}>
          {installResult.ok
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
          {installResult.message}
        </div>
      )}
    </motion.div>
  );
}
