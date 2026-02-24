import { useToast } from '../hooks/useToast';

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  );
}

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
    <div className="rounded-xl bg-zinc-50 ring-1 ring-zinc-950/5 dark:bg-zinc-800/50 dark:ring-white/5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/5">
        <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Agent MCP Configuration</h4>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
        >
          <CopyIcon className="h-3.5 w-3.5" />
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{config}</pre>
    </div>
  );
}
