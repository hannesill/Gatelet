import { useState, type FormEvent } from 'react';
import { Button } from '../components/catalyst/button';
import { Input } from '../components/catalyst/input';
import { Field, Label } from '../components/catalyst/fieldset';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z" clipRule="evenodd" />
    </svg>
  );
}

export function Login({ onLogin }: { onLogin: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        onLogin();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error || 'Invalid token');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <ShieldIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Gatelet</h1>
          <p className="mt-1 text-sm text-zinc-500">MCP permission proxy for AI agents</p>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-white p-6 ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field>
              <Label>Admin Token</Label>
              <Input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste your admin token"
                autoFocus
              />
            </Field>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-500/20">
                {error}
              </div>
            )}

            <Button type="submit" color="blue" className="w-full" disabled={loading || !token}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-600">
          The admin token is printed when the server starts.
        </p>
      </div>
    </div>
  );
}
