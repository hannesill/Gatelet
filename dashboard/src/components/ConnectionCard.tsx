import { useState } from 'react';
import { Button } from './catalyst/button';
import { Badge } from './catalyst/badge';
import { PolicyViewer } from './PolicyViewer';
import { PolicyEditor } from './PolicyEditor';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import type { ConnectionWithMeta } from '../types';
import clsx from 'clsx';

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 4V2M15 4V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="12" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.7" />
      <rect x="12" y="12" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="7" y="17" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
      <path d="M19 8.839l-7.616 3.808a2.75 2.75 0 01-2.768 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
    </svg>
  );
}

function DefaultProviderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" clipRule="evenodd" />
    </svg>
  );
}

const PROVIDER_ICONS: Record<string, React.FC<{ className?: string }>> = {
  google_calendar: GoogleCalendarIcon,
  google_gmail: MailIcon,
};

const PROVIDER_COLORS: Record<string, string> = {
  google_calendar: 'bg-blue-500/10 text-blue-500 ring-blue-500/20 dark:text-blue-400',
  outlook_calendar: 'bg-sky-500/10 text-sky-500 ring-sky-500/20 dark:text-sky-400',
  google_gmail: 'bg-red-500/10 text-red-500 ring-red-500/20 dark:text-red-400',
};

function TokenBadge({ status }: { status: 'valid' | 'expired' | 'unknown' }) {
  if (status === 'valid') return <Badge color="green">Valid</Badge>;
  if (status === 'expired') return <Badge color="yellow">Expired</Badge>;
  return <Badge color="zinc">Unknown</Badge>;
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={clsx(className, 'transition-transform duration-200', open && 'rotate-180')}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

interface Props {
  connection: ConnectionWithMeta;
  onDisconnect: () => void;
}

export function ConnectionCard({ connection, onDisconnect }: Props) {
  const [mode, setMode] = useState<'closed' | 'viewer' | 'editor'>('closed');
  const { toast } = useToast();

  const Icon = PROVIDER_ICONS[connection.provider_id] ?? DefaultProviderIcon;
  const colorClasses = PROVIDER_COLORS[connection.provider_id] ?? 'bg-zinc-500/10 text-zinc-500 ring-zinc-500/20 dark:text-zinc-400';

  async function handleDisconnect() {
    if (!confirm('Remove this connection?')) return;
    try {
      await api.deleteConnection(connection.id);
      toast('Connection removed');
      onDisconnect();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-950/5 transition-shadow hover:ring-zinc-950/10 dark:bg-zinc-800/50 dark:ring-white/5 dark:hover:ring-white/10">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', colorClasses)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white">{connection.displayName}</h3>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{connection.account_name}</p>
              </div>
              <TokenBadge status={connection.tokenStatus} />
            </div>

            <div className="mt-3 flex items-center gap-4">
              <span className="text-xs text-zinc-500">
                <span className="text-zinc-700 dark:text-zinc-300">{connection.enabledTools}</span>
                <span> / {connection.totalTools} tools</span>
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t border-zinc-200 pt-4 dark:border-white/5">
          <button
            onClick={() => setMode(mode === 'closed' ? 'viewer' : 'closed')}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <ChevronIcon open={mode !== 'closed'} className="h-3.5 w-3.5" />
            Policy
          </button>
          {mode === 'viewer' && (
            <button
              onClick={() => setMode('editor')}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              Edit YAML
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleDisconnect}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-400/80 dark:hover:text-red-400"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Expandable policy section */}
      {mode === 'viewer' && (
        <div className="border-t border-zinc-200 bg-zinc-50 p-5 dark:border-white/5 dark:bg-zinc-900/50">
          <PolicyViewer
            connectionId={connection.id}
            providerId={connection.provider_id}
            onEdit={() => setMode('editor')}
          />
        </div>
      )}
      {mode === 'editor' && (
        <div className="border-t border-zinc-200 bg-zinc-50 p-5 dark:border-white/5 dark:bg-zinc-900/50">
          <PolicyEditor
            connectionId={connection.id}
            providerId={connection.provider_id}
            onClose={() => setMode('viewer')}
            onSaved={onDisconnect}
          />
        </div>
      )}
    </div>
  );
}
