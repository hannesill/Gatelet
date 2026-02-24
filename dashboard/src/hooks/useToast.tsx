import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import clsx from 'clsx';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextValue {
  toast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue>(null!);

export function useToast() {
  return useContext(ToastContext);
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 pb-6">
        {toasts.map(t => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 animate-in',
              t.type === 'error'
                ? 'bg-red-50/90 text-red-700 ring-red-200 shadow-red-100/20 dark:bg-red-950/90 dark:text-red-200 dark:ring-red-500/20 dark:shadow-red-950/20'
                : 'bg-white/90 text-zinc-700 ring-zinc-950/10 shadow-zinc-200/20 dark:bg-zinc-800/90 dark:text-zinc-200 dark:ring-white/10 dark:shadow-black/20',
            )}
          >
            {t.type === 'error'
              ? <XCircleIcon className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
              : <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-500 dark:text-green-400" />
            }
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
