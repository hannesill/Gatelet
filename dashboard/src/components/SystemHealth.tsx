import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { cn } from '../utils';
import {
  Wrench,
  ShieldAlert,
  Loader2
} from 'lucide-react';

const statusConfig = {
  pass: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Healthy' },
  warn: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Warning' },
  fail: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Error' },
  skip: { color: 'text-zinc-500', bg: 'bg-zinc-500/10', label: 'Skipped' },
};

export function SystemHealth() {
  const { data, refetch } = useApi(() => api.getDoctor(), []);
  const [isFixing, setIsFixing] = useState(false);
  const { toast } = useToast();

  if (!data) return null;

  const allPass = data.every(c => c.status === 'pass');
  const issues = data.filter(c => c.status !== 'pass' && c.status !== 'skip');
  const hasFixable = data.some(c => c.fixable && c.status !== 'pass');

  if (allPass) return null;

  async function runFix() {
    setIsFixing(true);
    try {
      await api.fixDoctor();
      toast('Health issues resolved');
      refetch();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setIsFixing(false);
    }
  }

  return (
    <div className="animate-in glass overflow-hidden rounded-2xl shadow-lg shadow-zinc-950/5">
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">System Health Check</h3>
            <p className="text-xs text-zinc-500">{issues.length} components need attention</p>
          </div>
        </div>

        {hasFixable && (
          <button
            onClick={runFix}
            disabled={isFixing}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isFixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
            {isFixing ? 'Repairing...' : 'Auto-Fix Issues'}
          </button>
        )}
      </div>

      <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
        <div className="space-y-3">
          {data.filter(c => c.status !== 'pass').map(check => (
            <div key={check.id} className="flex items-start gap-3">
              <div className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", statusConfig[check.status].bg.replace('/10', ''))} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{check.name}</span>
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest", statusConfig[check.status].color)}>
                    {statusConfig[check.status].label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{check.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
