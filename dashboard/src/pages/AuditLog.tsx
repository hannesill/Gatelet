import { useState } from 'react';
import { Select } from '../components/catalyst/select';
import { Badge } from '../components/catalyst/badge';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import clsx from 'clsx';
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

function ResultBadge({ result }: { result: string }) {
  if (result === 'allowed') return <Badge color="green">Allowed</Badge>;
  if (result === 'denied') return <Badge color="red">Denied</Badge>;
  if (result === 'error') return <Badge color="yellow">Error</Badge>;
  return <Badge color="zinc">{result}</Badge>;
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={clsx(className, 'transition-transform duration-200', open && 'rotate-90')}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

const resultColors: Record<string, string> = {
  allowed: 'bg-green-500',
  denied: 'bg-red-500',
  error: 'bg-yellow-500',
};

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-950/[0.02] dark:hover:bg-white/[0.02]"
      >
        {/* Status dot */}
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', resultColors[entry.result] ?? 'bg-zinc-500')} />

        {/* Chevron */}
        <ChevronIcon open={expanded} className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-600" />

        {/* Tool name */}
        <code className="min-w-0 flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300">{entry.tool_name}</code>

        {/* Result badge */}
        <ResultBadge result={entry.result} />

        {/* Duration */}
        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-500">
          {entry.duration_ms !== null ? `${entry.duration_ms}ms` : '\u2014'}
        </span>

        {/* Time */}
        <span className="w-16 shrink-0 text-right text-xs text-zinc-400 dark:text-zinc-600" title={entry.timestamp}>
          {relativeTime(entry.timestamp)}
        </span>
      </button>

      {expanded && (
        <div className="mx-4 mb-3 rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-zinc-800/60 dark:ring-white/5">
          {entry.deny_reason && (
            <div className="mb-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-500/20">
              <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
              <span className="text-xs text-red-600 dark:text-red-400">{entry.deny_reason}</span>
            </div>
          )}

          {entry.original_params && (
            <div className="text-xs">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Parameters</span>
              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white px-3 py-2 text-zinc-700 ring-1 ring-zinc-950/5 dark:bg-zinc-900/60 dark:text-zinc-300 dark:ring-white/5">
                {entry.original_params}
              </pre>
            </div>
          )}

          {entry.mutated_params && (
            <div className="mt-3 text-xs">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Mutated</span>
              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white px-3 py-2 text-zinc-700 ring-1 ring-zinc-950/5 dark:bg-zinc-900/60 dark:text-zinc-300 dark:ring-white/5">
                {entry.mutated_params}
              </pre>
            </div>
          )}

          {!entry.deny_reason && !entry.original_params && !entry.mutated_params && (
            <p className="text-xs text-zinc-500 dark:text-zinc-600">No additional details</p>
          )}
        </div>
      )}
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
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="all">All time</option>
        </Select>
        <Select value={resultFilter} onChange={e => setResultFilter(e.target.value)}>
          <option value="">All results</option>
          <option value="allowed">Allowed</option>
          <option value="denied">Denied</option>
          <option value="error">Error</option>
        </Select>
        <Select value={toolFilter} onChange={e => setToolFilter(e.target.value)}>
          <option value="">All tools</option>
          {toolNames.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>

        {/* Summary stats */}
        {data && data.length > 0 && (
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
            {counts.allowed > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {counts.allowed}
              </span>
            )}
            {counts.denied > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {counts.denied}
              </span>
            )}
            {counts.error > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                {counts.error}
              </span>
            )}
            <span className="text-zinc-400 dark:text-zinc-600">{data.length} entries</span>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center text-sm text-zinc-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      )}

      {/* Empty state */}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
            <svg className="h-5 w-5 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-medium text-zinc-900 dark:text-white">No audit entries</h3>
          <p className="mt-1 text-sm text-zinc-500">No tool calls recorded for this period.</p>
        </div>
      )}

      {/* Entries list */}
      {data && data.length > 0 && (
        <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl ring-1 ring-zinc-950/5 dark:divide-white/5 dark:ring-white/5">
          {/* Header */}
          <div className="flex items-center gap-3 bg-zinc-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/30">
            <span className="w-2" />
            <span className="w-3.5" />
            <span className="min-w-0 flex-1">Tool</span>
            <span className="w-[68px]">Result</span>
            <span className="w-16 text-right">Duration</span>
            <span className="w-16 text-right">Time</span>
          </div>
          {data.map(entry => (
            <AuditRow key={entry.id ?? entry.timestamp} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
