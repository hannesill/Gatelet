import { useState } from 'react';
import { Button } from '../components/catalyst/button';
import { Input } from '../components/catalyst/input';
import { AgentConfig } from '../components/AgentConfig';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { cn } from '../utils';
import {
  Plus,
  Copy,
  Key,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Fingerprint,
  Zap,
  Info
} from 'lucide-react';

export function ApiKeys({ runtime }: { runtime?: { docker: boolean } }) {
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
    <div className="space-y-8">
      {/* Create key section */}
      <section className="overflow-hidden rounded-3xl glass-dark p-1 shadow-2xl shadow-zinc-950/20">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Generate Agent Key</h3>
            <p className="mt-1 text-xs text-zinc-500">Assign a name to your new proxy credential.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="e.g. Production Agent"
              className="w-full min-w-[200px] rounded-2xl border-none bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 ring-1 ring-white/10 transition-all focus:bg-white/10 focus:ring-2 focus:ring-indigo-500 sm:w-64"
              onKeyDown={e => e.key === 'Enter' && createKey()}
            />
            <button
              onClick={createKey}
              disabled={creating || !newKeyName.trim()}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? 'Working...' : 'Create'}
            </button>
          </div>
        </div>
      </section>

      {/* Newly created key - High visibility */}
      {createdKey && (
        <div className="animate-in space-y-6">
          <div className="relative rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-500/30">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/20">
                <Fingerprint className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-amber-900 dark:text-amber-200">Security Notice</h4>
                <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
                  Copy this key immediately. For your security, we cannot display it again.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl bg-white/50 px-4 py-3 font-mono text-sm font-bold text-amber-900 ring-1 ring-amber-200 dark:bg-black/20 dark:text-amber-100 dark:ring-amber-500/20">
                    {createdKey}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdKey); toast('Copied to clipboard'); }}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <AgentConfig apiKey={createdKey} runtime={runtime} />
        </div>
      )}

      {/* Active keys list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Active Credentials</h3>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
            {activeKeys.length} keys
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl glass shadow-sm">
          {activeKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-50 dark:bg-white/5">
                <Key className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              </div>
              <h4 className="text-base font-semibold text-zinc-900 dark:text-white">No active keys</h4>
              <p className="mt-1 text-sm text-zinc-500">Your agents need a key to access this proxy.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-white/5">
              {activeKeys.map((k) => (
                <div key={k.id} className="group flex items-center gap-4 px-6 py-5 transition-all hover:bg-zinc-50 dark:hover:bg-white/[0.01]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">{k.name}</span>
                      <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Live
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <code className="font-mono text-[10px] opacity-60">ID: {k.id}</code>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {k.last_used_at ? `Last used ${k.last_used_at}` : 'Never used'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeKey(k.id)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Revoke</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Revoked keys - minimized */}
      {revokedKeys.length > 0 && (
        <section className="space-y-3 opacity-60 grayscale transition-all hover:grayscale-0 hover:opacity-100">
          <h3 className="px-2 text-sm font-bold uppercase tracking-widest text-zinc-400">Revoked History</h3>
          <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-zinc-50/50 ring-1 ring-zinc-200 dark:divide-white/5 dark:bg-white/[0.02] dark:ring-white/5">
            {revokedKeys.map(k => (
              <div key={k.id} className="flex items-center gap-4 px-6 py-3">
                <ShieldAlert className="h-4 w-4 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-zinc-500 line-through">{k.name}</span>
                  <code className="ml-2 font-mono text-[10px] text-zinc-400">{k.id}</code>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Revoked</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
