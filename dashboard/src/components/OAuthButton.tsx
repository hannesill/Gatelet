import { cn } from '../utils';
import { ExternalLink, Lock } from 'lucide-react';
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
  accessLevel?: string;
}

export function OAuthButton({ provider, disabled, accessLevel }: Props) {
  const Logo = LOGOS[provider.id];

  function connect() {
    if (disabled) return;
    const url = `/api/connections/oauth/${provider.id}/start` + (accessLevel ? `?access=${encodeURIComponent(accessLevel)}` : '');
    window.location.replace(url);
  }

  if (!provider.configured) {
    return (
      <button
        disabled
        className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-400 cursor-not-allowed dark:bg-white/5 dark:text-zinc-600"
        title="Configure OAuth credentials in Settings first"
      >
        <div className="flex h-5 w-5 items-center justify-center grayscale opacity-50">
          {Logo ? <Logo className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </div>
        Connect {provider.displayName}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={disabled}
      className={cn(
        "group flex items-center gap-3 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold shadow-sm ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 hover:shadow-md hover:ring-zinc-300 active:scale-95 dark:bg-zinc-800 dark:ring-white/10 dark:hover:bg-zinc-700 dark:hover:ring-white/20 dark:text-white",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex h-5 w-5 items-center justify-center">
        {Logo ? <Logo className="h-4 w-4" /> : <ExternalLink className="h-3 w-3 text-indigo-600" />}
      </div>
      Connect {provider.displayName}
    </button>
  );
}
