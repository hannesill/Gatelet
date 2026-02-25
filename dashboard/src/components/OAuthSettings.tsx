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
  EyeOff,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from './ProviderLogos';
import type { OAuthProvider } from '../types';

const PROVIDER_ICONS: Record<string, any> = {
  google_calendar: GoogleCalendarLogo,
  outlook_calendar: OutlookCalendarLogo,
  google_gmail: GmailLogo,
};

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  user: { label: 'Your credentials', className: 'text-emerald-600 dark:text-emerald-400' },
  env: { label: 'Environment variable', className: 'text-blue-600 dark:text-blue-400' },
  builtin: { label: 'Built-in (unverified)', className: 'text-amber-600 dark:text-amber-400' },
  none: { label: 'Not configured', className: 'text-zinc-400' },
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
  const source = SOURCE_LABELS[provider.credentialSource] ?? SOURCE_LABELS.none;

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
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">{provider.displayName}</span>
          <span className={cn("ml-2 text-[10px] font-medium", source.className)}>{source.label}</span>
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

function BuiltinCredentialsBanner() {
  return (
    <div className="mb-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200/60 dark:bg-amber-950/20 dark:ring-amber-500/20">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">You're using built-in OAuth credentials</p>
          <p className="text-amber-700 dark:text-amber-300/80">
            Gatelet ships with shared OAuth app credentials that are not yet verified by Google or Microsoft.
            During sign-in, you'll see an "unverified app" warning — this is expected.
          </p>
          <p className="text-amber-700 dark:text-amber-300/80">
            Gatelet is fully self-hosted and open source. The built-in credentials do not give the
            publisher any access to your data — all tokens are stored locally on your machine, encrypted at rest.
          </p>
          <div className="flex items-start gap-2 pt-1 text-amber-700 dark:text-amber-300/80">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p>To avoid the warning, register your own OAuth app and enter your credentials below.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OAuthSettings({ providers }: { providers: OAuthProvider[] }) {
  if (providers.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No OAuth providers available.</p>;
  }

  const anyBuiltin = providers.some(p => p.credentialSource === 'builtin');

  return (
    <div className="space-y-3">
      {anyBuiltin && <BuiltinCredentialsBanner />}
      {providers.map(p => (
        <ProviderOAuthCard key={p.id} provider={p} />
      ))}
    </div>
  );
}
