import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { cn } from '../utils';
import {
  ChevronDown,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from './ProviderLogos';
import type { OAuthProvider } from '../types';

const PROVIDER_ICONS: Record<string, any> = {
  google_calendar: GoogleCalendarLogo,
  outlook_calendar: OutlookCalendarLogo,
  google_gmail: GmailLogo,
};

function ProviderOAuthCard({ provider }: { provider: OAuthProvider }) {
  const [expanded, setExpanded] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const Icon = PROVIDER_ICONS[provider.id];

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    api.getOAuthSettings(provider.id).then(data => {
      if (data.client_id) setClientId(data.client_id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [expanded, provider.id]);

  async function handleSave() {
    if (!clientId || !clientSecret) {
      toast('Both Client ID and Client Secret are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.saveOAuthSettings(provider.id, clientId, clientSecret);
      toast(`${provider.displayName} OAuth credentials saved`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl ring-1 ring-zinc-200 dark:ring-white/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/5">
          {Icon ? <Icon className="h-4 w-4" /> : null}
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">{provider.displayName}</span>
        </div>
        {provider.configured ? (
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Configured
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            <XCircle className="h-3.5 w-3.5" />
            Not configured
          </div>
        )}
        <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform duration-200", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 p-4 dark:border-white/5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="your-client-id"
                  className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-800 dark:text-white dark:ring-white/10 dark:focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Client Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder={provider.configured ? '••••••••' : 'your-client-secret'}
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-800 dark:text-white dark:ring-white/10 dark:focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OAuthSettings({ providers }: { providers: OAuthProvider[] }) {
  if (providers.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No OAuth providers available.</p>;
  }

  return (
    <div className="space-y-3">
      {providers.map(p => (
        <ProviderOAuthCard key={p.id} provider={p} />
      ))}
    </div>
  );
}
