import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { cn } from '../utils';
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';

interface Props {
  connectionId: string;
  compact?: boolean;
  autoTest?: boolean;
}

type TestState = 'idle' | 'loading' | 'success' | 'error';

export function TestConnectionButton({ connectionId, compact, autoTest }: Props) {
  const [state, setState] = useState<TestState>('idle');
  const [message, setMessage] = useState('');
  const autoTestedRef = useRef(false);

  async function handleTest() {
    setState('loading');
    setMessage('');
    try {
      const res = await api.testConnection(connectionId);
      if (res.ok) {
        setState('success');
        setMessage(res.preview ?? 'Connection verified');
      } else {
        setState('error');
        setMessage(res.error ?? 'Test failed');
      }
    } catch (e: any) {
      setState('error');
      setMessage(e.message || 'Test failed');
    }
  }

  useEffect(() => {
    if (autoTest && !autoTestedRef.current) {
      autoTestedRef.current = true;
      handleTest();
    }
  }, [autoTest]);

  if (state === 'loading') {
    return (
      <div className={cn(
        'flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400',
        compact && 'text-xs'
      )}>
        <Loader2 className={cn('animate-spin', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        Testing...
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className={cn(
        'flex items-center gap-2 text-sm',
        compact && 'text-xs'
      )}>
        <CheckCircle2 className={cn('text-emerald-500 shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <span className="text-emerald-700 dark:text-emerald-400 truncate">{message}</span>
        <button
          onClick={handleTest}
          className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          title="Test again"
        >
          <Zap className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={cn(
        'flex items-center gap-2 text-sm',
        compact && 'text-xs'
      )}>
        <XCircle className={cn('text-red-500 shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <span className="text-red-700 dark:text-red-400 truncate" title={message}>{message}</span>
        <button
          onClick={handleTest}
          className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          title="Retry"
        >
          <Zap className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleTest}
      className={cn(
        'flex items-center gap-2 rounded-xl font-medium transition-all duration-200',
        compact
          ? 'px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
          : 'px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
      )}
    >
      <Zap className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      Test
    </button>
  );
}
