import { Button } from './catalyst/button';
import type { OAuthProvider } from '../types';

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm4.943-.5a.75.75 0 01.75-.75h5a.75.75 0 01.75.75v5a.75.75 0 01-1.5 0V6.56l-5.72 5.72a.75.75 0 11-1.06-1.06l5.72-5.72h-3.94a.75.75 0 01-.75-.75z" clipRule="evenodd" />
    </svg>
  );
}

export function OAuthButton({ provider }: { provider: OAuthProvider }) {
  function connect() {
    window.location.href = `/api/connections/oauth/${provider.id}/start`;
  }

  if (!provider.configured) {
    return (
      <Button disabled outline title="Configure OAuth credentials first">
        Connect {provider.displayName}
        <span className="ml-1 text-xs text-red-400">(not configured)</span>
      </Button>
    );
  }

  return (
    <Button outline onClick={connect}>
      <ExternalLinkIcon className="h-4 w-4 -ml-0.5 text-zinc-500 dark:text-zinc-400" />
      Connect {provider.displayName}
    </Button>
  );
}
