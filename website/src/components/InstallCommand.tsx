import { useState, useEffect } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { cn } from '../utils';

type Platform = 'mac' | 'linux' | 'windows';

const commands: Record<Platform, { command: string; label: string }> = {
  mac: {
    command: 'curl -fsSL https://gatelet.dev/install-host.sh | bash',
    label: 'macOS',
  },
  linux: {
    command: 'curl -fsSL https://gatelet.dev/install-host.sh | bash',
    label: 'Linux',
  },
  windows: {
    command: 'irm https://gatelet.dev/install.ps1 | iex',
    label: 'PowerShell',
  },
};

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'mac';
  const p = ((navigator as any).userAgentData?.platform || navigator.platform || '').toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (p.includes('win') || ua.includes('win')) return 'windows';
  if (p.includes('linux') || ua.includes('linux')) return 'linux';
  return 'mac';
}

export function InstallCommand() {
  const [platform, setPlatform] = useState<Platform>('mac');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const current = commands[platform];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 w-full max-w-xl">
      {/* Platform selector */}
      <div className="mb-3 flex items-center justify-center gap-1">
        {(Object.keys(commands) as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); setCopied(false); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer',
              platform === p
                ? 'bg-zinc-800 text-white dark:bg-white/15 dark:text-white'
                : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
            )}
          >
            {commands[p].label}
          </button>
        ))}
      </div>

      {/* Command bar */}
      <div className="group relative flex w-full items-center overflow-hidden rounded-2xl bg-zinc-950 p-1.5 shadow-2xl ring-1 ring-zinc-900/50 dark:bg-black/40 dark:ring-white/10">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center text-zinc-500">
          <Terminal className="h-5 w-5" />
        </div>
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm font-medium text-zinc-300 scrollbar-hide select-all pr-2">
          {current.command}
          <span className="text-zinc-600 ml-3 select-none">{'#'} {current.label}</span>
        </code>
        <button
          onClick={handleCopy}
          className={cn(
            "relative flex h-12 w-12 sm:w-28 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer",
            copied
              ? "bg-emerald-500 text-white"
              : "bg-white/10 text-white hover:bg-white/20 active:scale-95"
          )}
        >
          <div className="relative h-4 w-4">
            <Check className={cn("absolute inset-0 h-4 w-4 transition-all duration-200", copied ? "scale-100 opacity-100" : "scale-0 opacity-0")} />
            <Copy className={cn("absolute inset-0 h-4 w-4 transition-all duration-200", copied ? "scale-0 opacity-0" : "scale-100 opacity-100")} />
          </div>
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}
