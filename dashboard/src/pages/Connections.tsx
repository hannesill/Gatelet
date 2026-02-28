import { useState } from 'react';
import { ConnectionCard } from '../components/ConnectionCard';
import { OAuthButton } from '../components/OAuthButton';
import { OAuthInfo } from '../components/OAuthSettings';
import { SystemHealth } from '../components/SystemHealth';
import { UpdateBanner } from '../components/UpdateBanner';
import { Sparkles, Plus, Info, X, AlertTriangle } from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from '../components/ProviderLogos';
import type { Status } from '../types';

function EmptyState({ oauthProviders }: { oauthProviders: Status['oauthProviders'] }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="animate-in relative flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-zinc-200 bg-white py-20 px-6 text-center dark:border-zinc-800 dark:bg-white/[0.02] overflow-hidden">
      <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 to-transparent pointer-events-none" />

      <button
        onClick={() => setShowInfo(!showInfo)}
        className="absolute right-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
        title="About OAuth Credentials"
      >
        {showInfo ? <X className="h-5 w-5" /> : <Info className="h-5 w-5" />}
      </button>

      {showInfo && (
        <div className="animate-fade absolute inset-0 z-10 flex items-center justify-center bg-white/95 p-6 backdrop-blur-sm dark:bg-zinc-900/95">
          <div className="max-w-md text-left">
            <OAuthInfo />
          </div>
        </div>
      )}

      <div className="relative flex h-24 w-48 items-center justify-center mb-4">
        <div className="absolute left-0 top-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10 -rotate-12 translate-x-4">
          <GmailLogo className="h-8 w-8" />
        </div>
        <div className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10">
          <Plus className="h-10 w-10 text-zinc-300" />
        </div>
        <div className="absolute right-0 top-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10 rotate-12 -translate-x-4">
          <GoogleCalendarLogo className="h-8 w-8" />
        </div>
        <div className="absolute right-4 bottom-0 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10 rotate-6 translate-y-2">
          <OutlookCalendarLogo className="h-7 w-7" />
        </div>
      </div>

      <h3 className="relative z-10 mt-8 text-xl font-bold text-zinc-900 dark:text-white">Connect your first service</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Gatelet works best when connected to your existing accounts.
        Select a provider below to get started.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        {oauthProviders.map(p => (
          <OAuthButton key={p.id} provider={p} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  status: Status;
  onRefresh: () => void;
}

export function Connections({ status, onRefresh }: Props) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="space-y-10">
      <UpdateBanner update={status.update} />
      <SystemHealth />

      {status.connections.length === 0 ? (
        <EmptyState oauthProviders={status.oauthProviders} />
      ) : (
        <div className="space-y-8">
          {status.connections.some(c => c.needsReauth) && (
            <div className="animate-in glass overflow-hidden rounded-2xl border border-red-200 dark:border-red-500/20">
              <div className="flex items-start gap-4 p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">Re-authorization Required</h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-400/80">
                    A connection needs to be re-authorized to continue working.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {status.connections.map((conn, i) => (
              <div
                key={conn.id}
                className="animate-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <ConnectionCard
                  connection={conn}
                  onDisconnect={onRefresh}
                />
              </div>
            ))}
          </div>

          {status.oauthProviders.length > 0 && (
            <div className="animate-fade rounded-3xl glass p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
                    Available Integrations
                  </h3>
                </div>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
                  title="About OAuth Credentials"
                >
                  {showInfo ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </button>
              </div>

              {showInfo && (
                <div className="animate-fade overflow-hidden">
                  <div className="pb-8">
                    <OAuthInfo />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                {status.oauthProviders.map(p => (
                  <OAuthButton key={p.id} provider={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
