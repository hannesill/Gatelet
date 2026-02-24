import { useToast } from '../hooks/useToast';
import { Copy, Terminal, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function AgentConfig({ apiKey }: { apiKey: string }) {
  const { toast } = useToast();
  const config = JSON.stringify({
    mcpServers: {
      gatelet: {
        url: 'http://localhost:4000/mcp',
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
      className="overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl shadow-zinc-950/20 ring-1 ring-white/10"
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
