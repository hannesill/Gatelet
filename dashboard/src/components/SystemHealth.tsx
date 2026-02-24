import { useState } from 'react';
import { Button } from './catalyst/button';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import clsx from 'clsx';

const statusConfig = {
  pass: { color: 'bg-green-500', label: 'Healthy' },
  warn: { color: 'bg-yellow-500', label: 'Warning' },
  fail: { color: 'bg-red-500', label: 'Error' },
  skip: { color: 'bg-zinc-500', label: 'Skipped' },
};

export function SystemHealth() {
  const { data, refetch } = useApi(() => api.getDoctor(), []);
  const [fixing, setFixing] = useState(false);
  const { toast } = useToast();

  if (!data) return null;

  const allPass = data.every(c => c.status === 'pass');
  const hasFixable = data.some(c => c.fixable && c.status !== 'pass');
  const hasIssues = data.some(c => c.status !== 'pass' && c.status !== 'skip');

  // Don't show when everything is fine
  if (allPass) return null;

  async function runFix() {
    setFixing(true);
    try {
      await api.fixDoctor();
      toast('Fix attempted');
      refetch();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className={clsx(
      'rounded-xl p-4 ring-1',
      hasIssues
        ? 'bg-yellow-50 ring-yellow-200 dark:bg-yellow-950/20 dark:ring-yellow-500/20'
        : 'bg-zinc-50 ring-zinc-950/5 dark:bg-zinc-800/50 dark:ring-white/5',
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <svg className={clsx('h-4 w-4', hasIssues ? 'text-yellow-500 dark:text-yellow-400' : 'text-zinc-400')} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">System Health</h3>
        </div>
        {hasFixable && (
          <Button plain onClick={runFix} disabled={fixing}>
            {fixing ? 'Fixing...' : 'Fix Issues'}
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {data.filter(c => c.status !== 'pass').map(check => (
          <div key={check.id} className="flex items-center gap-2.5 text-xs">
            <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', statusConfig[check.status]?.color)} />
            <span className="text-zinc-700 dark:text-zinc-300">{check.name}</span>
            <span className="text-zinc-500">{check.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
