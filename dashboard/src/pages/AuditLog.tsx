import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Clock, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileCode,
  Terminal,
  Zap,
  Info,
  Loader2
} from 'lucide-react';
import type { AuditEntry } from '../types';

function relativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function ResultIcon({ result }: { result: string }) {
  if (result === 'allowed') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (result === 'denied') return <XCircle className="h-4 w-4 text-red-500" />;
  if (result === 'error') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Info className="h-4 w-4 text-zinc-500" />;
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group border-b border-zinc-100 last:border-0 dark:border-white/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-4 px-6 py-4 text-left transition-all duration-200",
          expanded ? "bg-zinc-50 dark:bg-white/[0.02]" : "hover:bg-zinc-50/50 dark:hover:bg-white/[0.01]"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
          <ResultIcon result={entry.result} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
              {entry.tool_name}
            </code>
            {entry.duration_ms !== null && (
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                <Zap className="h-2.5 w-2.5" />
                {entry.duration_ms}ms
              </div>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(entry.timestamp)}
            </span>
            <span className="capitalize">{entry.result}</span>
          </div>
        </div>

        <ChevronRight className={cn(
          "h-4 w-4 text-zinc-300 transition-transform duration-300 dark:text-zinc-600",
          expanded && "rotate-90"
        )} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2">
              <div className="space-y-4">
                {entry.deny_reason && (
                  <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{entry.deny_reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {entry.original_params && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        <Terminal className="h-3 w-3" />
                        Input Parameters
                      </div>
                      <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-300 scrollbar-hide">
                        {entry.original_params}
                      </pre>
                    </div>
                  )}

                  {entry.mutated_params && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                        <FileCode className="h-3 w-3" />
                        Mutated Parameters
                      </div>
                      <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 text-xs leading-relaxed text-amber-200/80 scrollbar-hide">
                        {entry.mutated_params}
                      </pre>
                    </div>
                  )}
                </div>

                {!entry.deny_reason && !entry.original_params && !entry.mutated_params && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Info className="h-8 w-8 text-zinc-200 dark:text-zinc-800" />
                    <p className="mt-2 text-sm text-zinc-500">No extra details available for this call.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function periodToParams(period: string): Record<string, string> {
  const params: Record<string, string> = {};
  const now = new Date();
  if (period === '1h') {
    params.from = new Date(now.getTime() - 3600_000).toISOString();
  } else if (period === '24h') {
    params.from = new Date(now.getTime() - 86400_000).toISOString();
  } else if (period === '7d') {
    params.from = new Date(now.getTime() - 7 * 86400_000).toISOString();
  }
  return params;
}

export function AuditLog() {
  const [toolFilter, setToolFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [period, setPeriod] = useState('24h');

  const params: Record<string, string> = {
    limit: '100',
    ...periodToParams(period),
    ...(toolFilter ? { tool_name: toolFilter } : {}),
    ...(resultFilter ? { result: resultFilter } : {}),
  };

  const { data, loading } = useApi(
    () => api.getAudit(params),
    [toolFilter, resultFilter, period],
  );

  const toolNames = [...new Set(data?.map(e => e.tool_name) ?? [])].sort();

  // Count by result type
  const counts = { allowed: 0, denied: 0, error: 0 };
  data?.forEach(e => {
    if (e.result in counts) counts[e.result as keyof typeof counts]++;
  });

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl glass p-1 shadow-sm">
          <div className="pl-3 pr-1 text-zinc-400">
            <Filter className="h-3.5 w-3.5" />
          </div>
          <select 
            value={period} 
            onChange={e => setPeriod(e.target.value)}
            className="bg-transparent border-0 text-xs font-semibold py-1.5 focus:ring-0 dark:text-zinc-300"
          >
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </select>
          <div className="w-px h-4 bg-zinc-200 dark:bg-white/10 mx-1" />
          <select 
            value={resultFilter} 
            onChange={e => setResultFilter(e.target.value)}
            className="bg-transparent border-0 text-xs font-semibold py-1.5 focus:ring-0 dark:text-zinc-300"
          >
            <option value="">All results</option>
            <option value="allowed">Allowed</option>
            <option value="denied">Denied</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Search tool */}
        <div className="flex flex-1 items-center gap-3 rounded-2xl glass px-4 py-2 shadow-sm">
          <Search className="h-3.5 w-3.5 text-zinc-400" />
          <select 
            value={toolFilter} 
            onChange={e => setToolFilter(e.target.value)}
            className="flex-1 bg-transparent border-0 text-xs font-semibold p-0 focus:ring-0 dark:text-zinc-300"
          >
            <option value="">Search all tools...</option>
            {toolNames.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Chips */}
      {data && data.length > 0 && (
        <div className="flex gap-2">
          {counts.allowed > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {counts.allowed} Allowed
            </div>
          )}
          {counts.denied > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold text-red-700 dark:bg-red-500/10 dark:text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {counts.denied} Denied
            </div>
          )}
          <div className="flex-1" />
          <div className="text-xs font-medium text-zinc-400 pt-1">
            {data.length} entries shown
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="overflow-hidden rounded-2xl glass shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="mt-4 text-sm font-medium">Fetching audit trail...</p>
          </div>
        ) : data && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-50 dark:bg-white/5 mb-4">
              <FileCode className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Clean as a whistle</h3>
            <p className="mt-1 text-sm text-zinc-500">No activity recorded for the selected filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {data?.map((entry) => (
              <AuditRow key={entry.id ?? entry.timestamp} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
