import { useState, useRef, useEffect } from 'react';
import { cn } from '../utils';
import { ExternalLink, Lock, Settings, Shield, ShieldCheck, Info, Check } from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, MicrosoftLogo } from './ProviderLogos';
import type { OAuthProvider } from '../types';

const LOGOS: Record<string, any> = {
  google_calendar: GoogleCalendarLogo,
  outlook_calendar: MicrosoftLogo,
  google_gmail: GmailLogo,
  outlook_mail: MicrosoftLogo,
};

interface Props {
  provider: OAuthProvider;
  disabled?: boolean;
}

export function OAuthButton({ provider, disabled }: Props) {
  const Logo = LOGOS[provider.id];
  const hasAccessLevels = provider.configured && provider.accessLevels && provider.accessLevels.length > 1;
  const defaultLevel = hasAccessLevels
    ? (provider.accessLevels!.includes('full-access') ? 'full-access' : provider.accessLevels![0])
    : '';
  const [selectedLevel, setSelectedLevel] = useState(defaultLevel);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  function connect() {
    if (disabled) return;
    const accessParam = hasAccessLevels ? `?access=${encodeURIComponent(selectedLevel)}` : '';
    window.location.replace(`/api/connections/oauth/${provider.id}/start${accessParam}`);
  }

  if (!provider.configured) {
    return (
      <div className="relative">
        <button
          disabled
          className="flex w-full items-center gap-3 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-400 cursor-not-allowed dark:bg-white/5 dark:text-zinc-600"
          title="Configure OAuth credentials in Settings first"
        >
          <div className="flex h-5 w-5 items-center justify-center grayscale opacity-50">
            {Logo ? <Logo className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </div>
          Connect {provider.displayName}
        </button>
      </div>
    );
  }

  const isOutlook = provider.id.startsWith('outlook_');

  return (
    <div ref={containerRef} className="relative">
      <div className={cn(
        "flex rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-800 dark:ring-white/10 dark:hover:ring-white/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <button
          onClick={connect}
          disabled={disabled}
          className={cn(
            "group flex flex-1 items-center gap-3 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-zinc-50 dark:text-white dark:hover:bg-zinc-700",
            hasAccessLevels ? "rounded-l-2xl" : "rounded-2xl"
          )}
        >
          <div className="flex h-5 w-5 items-center justify-center">
            {Logo ? <Logo className="h-4 w-4" /> : <ExternalLink className="h-3 w-3 text-indigo-600" />}
          </div>
          Connect {provider.displayName}
        </button>
        {hasAccessLevels && (
          <button
            onClick={() => setShowMenu(prev => !prev)}
            disabled={disabled}
            className="flex items-center justify-center rounded-r-2xl border-l border-zinc-200 px-3 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-700"
          >
            <Settings className="h-3.5 w-3.5 text-zinc-400" />
          </button>
        )}
      </div>

      {hasAccessLevels && showMenu && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
          {provider.accessLevels!.map(level => {
            const selected = selectedLevel === level;
            const isReadOnly = level === 'read-only';
            const Icon = isReadOnly ? ShieldCheck : Shield;
            return (
              <button
                key={level}
                onClick={() => { setSelectedLevel(level); setShowMenu(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                  selected
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-white"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {isReadOnly ? 'Read-only' : 'Full access'}
                {selected && <Check className="ml-auto h-3 w-3" />}
              </button>
            );
          })}
          {isOutlook && (
            <div className="mt-1 flex items-start gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-2 dark:bg-zinc-700/50">
              <Info className="h-3 w-3 mt-0.5 shrink-0 text-zinc-400" />
              <p className="text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
                If full access doesn't work, try read-only — some institutional Outlook accounts require it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
