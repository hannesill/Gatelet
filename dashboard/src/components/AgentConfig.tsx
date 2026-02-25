import { useState } from 'react';
import { useToast } from '../hooks/useToast';
import { Copy, Terminal, CheckCircle2, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';

export function AgentConfig({ apiKey }: { apiKey: string }) {
  const { toast } = useToast();
  const [mcpUrl, setMcpUrl] = useState(
    `http://${window.location.hostname}:4000/mcp`,
  );

  const config = JSON.stringify({
    mcpServers: {
      gatelet: {
        url: mcpUrl,
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    },
  }, null, 2);

  function copy() {
    navigator.clipboard.writeText(config).then(() => toast('Config copied!'));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-dark overflow-hidden rounded-2xl shadow-2xl shadow-zinc-950/20"
    >
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-400" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">MCP Configuration</h4>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-indigo-500 active:scale-95"
        >
          <Copy className="h-3 w-3" />
          Copy JSON
        </button>
      </div>
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
      <div className="relative">
        <pre className="overflow-x-auto p-6 font-mono text-xs leading-relaxed text-zinc-300 scrollbar-hide">
          {config}
        </pre>
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Ready to use
        </div>
      </div>
    </motion.div>
  );
}
