import { ConnectionCard } from '../components/ConnectionCard';
import { OAuthButton } from '../components/OAuthButton';
import { SystemHealth } from '../components/SystemHealth';
import type { Status } from '../types';

function EmptyState({ oauthProviders }: { oauthProviders: Status['oauthProviders'] }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 py-12 px-6 text-center dark:border-zinc-700">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
        <svg className="h-6 w-6 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
          <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
          <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-white">No connections yet</h3>
      <p className="mt-1 text-sm text-zinc-500">Connect an account to get started.</p>
      <div className="mt-6 flex gap-3 flex-wrap justify-center">
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
  return (
    <div className="space-y-6">
      <SystemHealth />

      {status.connections.length === 0 ? (
        <EmptyState oauthProviders={status.oauthProviders} />
      ) : (
        <>
          <div className="space-y-4">
            {status.connections.map(conn => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                onDisconnect={onRefresh}
              />
            ))}
          </div>

          {status.oauthProviders.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {status.oauthProviders.map(p => (
                <OAuthButton key={p.id} provider={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
