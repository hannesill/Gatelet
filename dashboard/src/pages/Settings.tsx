import { OAuthSettings } from '../components/OAuthSettings';
import { useApi } from '../hooks/useApi';
import { api } from '../api';

export function Settings() {
  const { data: status } = useApi(() => api.getStatus(), []);

  return (
    <div className="space-y-8">
      {status && status.oauthProviders.length > 0 && (
        <section>
          <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-white">Integrations</h2>
          <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-zinc-200 backdrop-blur-sm dark:bg-zinc-900/60 dark:ring-white/10">
            <OAuthSettings providers={status.oauthProviders} />
          </div>
        </section>
      )}
    </div>
  );
}
