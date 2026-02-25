import { cn } from '../utils';
import { ExternalLink, Lock } from 'lucide-react';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from './ProviderLogos';
import type { OAuthProvider } from '../types';

const LOGOS: Record<string, any> = {
  google_calendar: GoogleCalendarLogo,
  outlook_calendar: OutlookCalendarLogo,
  google_gmail: GmailLogo,
};

export function OAuthButton({ provider }: { provider: OAuthProvider }) {
  const Logo = LOGOS[provider.id];

  function connect() {
    window.location.href = `/api/connections/oauth/${provider.id}/start`;
  }

  if (!provider.configured) {
    return (
      <button 
        disabled 
        className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-400 cursor-not-allowed dark:bg-white/5 dark:text-zinc-600"
        title="Configure OAuth credentials in the server config first"
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
      className={cn(
        "group flex items-center gap-3 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold shadow-sm ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 hover:shadow-md hover:ring-zinc-300 active:scale-95 dark:bg-zinc-800 dark:ring-white/10 dark:hover:bg-zinc-700 dark:hover:ring-white/20 dark:text-white"
      )}
    >
      <div className="flex h-5 w-5 items-center justify-center">
        {Logo ? <Logo className="h-4 w-4" /> : <ExternalLink className="h-3 w-3 text-indigo-600" />}
      </div>
      Connect {provider.displayName}
    </button>
  );
}
