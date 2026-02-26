import { useState, useEffect } from 'react';
import { PolicyViewer } from './PolicyViewer';
import { PolicyFormEditor } from './PolicyFormEditor';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { cn } from '../utils';
import {
  Link2,
  ChevronDown,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings2,
  RefreshCw,
  Pause,
  Play,
  Save,
  Loader2
} from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from './ProviderLogos';
import { TestConnectionButton } from './TestConnectionButton';
import type { ConnectionWithMeta } from '../types';

const PROVIDER_ICONS: Record<string, any> = {
  google_calendar: GoogleCalendarLogo,
  outlook_calendar: OutlookCalendarLogo,
  google_gmail: GmailLogo,
};

const PROVIDERS_WITH_SETTINGS = new Set(['google_gmail']);

const PROVIDER_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  google_calendar: { bg: 'bg-zinc-100 dark:bg-white/5', text: 'text-zinc-700 dark:text-zinc-300', icon: '' },
  outlook_calendar: { bg: 'bg-zinc-100 dark:bg-white/5', text: 'text-zinc-700 dark:text-zinc-300', icon: '' },
  google_gmail: { bg: 'bg-zinc-100 dark:bg-white/5', text: 'text-zinc-700 dark:text-zinc-300', icon: '' },
};

function TokenStatus({ status, expiresAt }: { status: 'valid' | 'expired' | 'unknown'; expiresAt?: number }) {
  if (status === 'valid') {
    let label = 'Active';
    if (typeof expiresAt === 'number') {
      const minutesLeft = Math.round((expiresAt - Date.now()) / 60_000);
      if (minutesLeft > 0 && minutesLeft <= 60) {
        label = `Active (${minutesLeft}m)`;
      }
    }
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {label}
      </div>
    );
  }
  if (status === 'expired') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        <AlertCircle className="h-3 w-3" />
        Expired
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400">
      <HelpCircle className="h-3 w-3" />
      Unknown
    </div>
  );
}

function ConnectionSettings({ connectionId, providerId }: { connectionId: string; providerId: string }) {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailAliasSuffix, setEmailAliasSuffix] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    api.getConnectionSettings(connectionId).then(s => {
      setSettings(s);
      if (typeof s.emailAliasSuffix === 'string') setEmailAliasSuffix(s.emailAliasSuffix);
    });
  }, [connectionId]);

  if (settings === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings...
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.saveConnectionSettings(connectionId, { emailAliasSuffix });
      toast('Settings saved');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Email Alias Suffix
        </label>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Appended to your email address for agent-sent emails (e.g. you+agent@gmail.com)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={emailAliasSuffix}
            onChange={e => setEmailAliasSuffix(e.target.value)}
            placeholder="+agent"
            className="rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-800 dark:text-white dark:ring-white/10 dark:focus:ring-indigo-400"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  connection: ConnectionWithMeta;
  onDisconnect: () => void;
}

export function ConnectionCard({ connection, onDisconnect }: Props) {
  const [mode, setMode] = useState<'closed' | 'viewer' | 'editor' | 'settings'>('closed');
  const [toggling, setToggling] = useState(false);
  const { toast } = useToast();

  const Icon = PROVIDER_ICONS[connection.provider_id] ?? Link2;
  const theme = PROVIDER_COLORS[connection.provider_id] ?? {
    bg: 'bg-zinc-50 dark:bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-300',
    icon: 'text-zinc-600 dark:text-zinc-400'
  };

  const paused = !connection.enabled;

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

  async function handleToggleEnabled() {
    setToggling(true);
    try {
      await api.toggleConnection(connection.id, !connection.enabled);
      toast(connection.enabled ? 'Connection paused' : 'Connection resumed');
      onDisconnect(); // triggers refresh
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setToggling(false);
    }
  }

  function handleReauthorize() {
    window.location.href = `/api/connections/oauth/${connection.provider_id}/start`;
  }

  return (
    <div
      className={cn(
        "group glass overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-zinc-950/[0.03] hover:ring-zinc-400/40 dark:hover:ring-white/20",
        paused && "opacity-60 grayscale"
      )}
    >
      <div className="p-6">
        <div className="flex items-start gap-5">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105', theme.bg)}>
            <Icon className={cn('h-7 w-7', theme.icon)} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-white">
                  {connection.displayName}
                </h3>
                <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {connection.account_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {paused && (
                  <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-500/10 dark:text-zinc-400">
                    <Pause className="h-3 w-3" />
                    Paused
                  </div>
                )}
                <TokenStatus status={connection.tokenStatus} expiresAt={connection.tokenExpiresAt} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex h-5 items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
                  {connection.enabledTools}
                </div>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  / {connection.totalTools} tools active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-white/5">
          <div className="flex gap-1.5">
            <button
              onClick={() => setMode(mode === 'closed' ? 'viewer' : 'closed')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                mode !== 'closed' && mode !== 'settings'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
              )}
            >
              <Settings2 className={cn('h-4 w-4 transition-transform duration-300', mode !== 'closed' && mode !== 'settings' && 'rotate-90')} />
              Manage Policy
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', mode !== 'closed' && mode !== 'settings' && 'rotate-180')} />
            </button>

            {mode === 'viewer' && (
              <button
                onClick={() => setMode('editor')}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition-all duration-200 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              >
                <Edit3 className="h-4 w-4" />
                Edit Policy
              </button>
            )}

            <TestConnectionButton connectionId={connection.id} />
          </div>

          <div className="flex items-center gap-1.5">
            {connection.tokenStatus === 'expired' && (
              <button
                onClick={handleReauthorize}
                className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-all duration-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Re-authorize</span>
              </button>
            )}

            {PROVIDERS_WITH_SETTINGS.has(connection.provider_id) && (
              <button
                onClick={() => setMode(mode === 'settings' ? 'closed' : 'settings')}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                  mode === 'settings'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
                )}
                title="Connection settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleToggleEnabled}
              disabled={toggling}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                paused
                  ? 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
              )}
              title={paused ? 'Resume connection' : 'Pause connection'}
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : paused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Section */}
      {mode !== 'closed' && (
        <div className="animate-fade border-t border-zinc-100 bg-zinc-50/50 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="p-6">
            {mode === 'viewer' && (
              <PolicyViewer
                connectionId={connection.id}
                providerId={connection.provider_id}
                onEdit={() => setMode('editor')}
              />
            )}
            {mode === 'editor' && (
              <PolicyFormEditor
                connectionId={connection.id}
                providerId={connection.provider_id}
                accountName={connection.account_name}
                onClose={() => setMode('viewer')}
                onSaved={onDisconnect}
              />
            )}
            {mode === 'settings' && (
              <ConnectionSettings
                connectionId={connection.id}
                providerId={connection.provider_id}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
