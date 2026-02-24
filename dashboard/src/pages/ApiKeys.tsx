import { useState } from 'react';
import { Button } from '../components/catalyst/button';
import { Input } from '../components/catalyst/input';
import { Badge } from '../components/catalyst/badge';
import { AgentConfig } from '../components/AgentConfig';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { api } from '../api';

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  );
}

export function ApiKeys() {
  const { data: keys, refetch } = useApi(() => api.getApiKeys(), []);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createApiKey(newKeyName.trim());
      setCreatedKey(res.key);
      setNewKeyName('');
      refetch();
      toast('API key created');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key?')) return;
    try {
      await api.revokeApiKey(id);
      refetch();
      toast('API key revoked');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  const activeKeys = keys?.filter(k => !k.revoked_at) ?? [];
  const revokedKeys = keys?.filter(k => k.revoked_at) ?? [];

  return (
    <div className="space-y-6">
      {/* Create key form */}
      <div className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-950/5 dark:bg-zinc-800/50 dark:ring-white/5">
        <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-white">Create new key</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. My Agent)"
              onKeyDown={e => e.key === 'Enter' && createKey()}
            />
          </div>
          <Button color="blue" onClick={createKey} disabled={creating || !newKeyName.trim()}>
            <PlusIcon className="h-4 w-4 -ml-0.5" />
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>

      {/* Newly created key */}
      {createdKey && (
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 p-5 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-500/20">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Copy this key &mdash; it won't be shown again</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-blue-100 px-2.5 py-1.5 text-xs text-blue-900 ring-1 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-100 dark:ring-blue-500/10">
                    {createdKey}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdKey); toast('Copied!'); }}
                    className="shrink-0 rounded-md p-2 text-blue-600 transition-colors hover:bg-blue-500/10 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Copy key"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <AgentConfig apiKey={createdKey} />
        </div>
      )}

      {/* Active keys */}
      {activeKeys.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Active keys</h3>
          <div className="divide-y divide-zinc-200 rounded-xl ring-1 ring-zinc-950/5 dark:divide-white/5 dark:ring-white/5">
            {activeKeys.map(k => (
              <div key={k.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{k.name}</span>
                    <Badge color="green">Active</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                    <code>{k.id}</code>
                    <span>&middot;</span>
                    <span>{k.last_used_at ? `Last used ${k.last_used_at}` : 'Never used'}</span>
                  </div>
                </div>
                <button
                  onClick={() => revokeKey(k.id)}
                  className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-400/80 dark:hover:text-red-400"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-500">Revoked keys</h3>
          <div className="divide-y divide-zinc-200 rounded-xl ring-1 ring-zinc-950/5 opacity-60 dark:divide-white/5 dark:ring-white/5">
            {revokedKeys.map(k => (
              <div key={k.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400 line-through">{k.name}</span>
                    <Badge color="red">Revoked</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-600"><code>{k.id}</code></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {keys && keys.length === 0 && !createdKey && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
            <svg className="h-5 w-5 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-medium text-zinc-900 dark:text-white">No API keys</h3>
          <p className="mt-1 text-sm text-zinc-500">Create a key to connect your agent.</p>
        </div>
      )}
    </div>
  );
}
