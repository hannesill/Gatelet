import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/Logo';
import { DynamicBackground } from '../components/DynamicBackground';
import { Key, ArrowRight, Loader2, AlertCircle, Shield } from 'lucide-react';
import { cn } from '../utils';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [token, setToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (requires2FA && totpInputRef.current) {
      totpInputRef.current.focus();
    }
  }, [requires2FA]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          totpCode: totpCode || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (data?.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (data?.ok) {
        onLogin();
      } else {
        setError(data?.error || 'Invalid credentials');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-gradient relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <DynamicBackground />
      {/* Background blobs for atmosphere */}
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px]" />
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-zinc-500/10 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-[400px]"
      >
        {/* Branding */}
        <div className="mb-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-500/40 ring-4 ring-white dark:ring-zinc-950"
          >
            <Logo className="h-9 w-9 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="font-[Fraunces] text-3xl font-bold italic text-zinc-900 dark:text-white"
          >
            Gatelet
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2 text-zinc-500 dark:text-zinc-400"
          >
            Secure Proxy for AI Agents
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="overflow-hidden rounded-3xl bg-white/80 p-8 shadow-2xl shadow-zinc-950/5 ring-1 ring-zinc-200 backdrop-blur-xl dark:bg-zinc-900/80 dark:shadow-black/40 dark:ring-white/10"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Admin Token Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Admin Token
              </label>
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Key className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Paste token..."
                  autoFocus={!requires2FA}
                  disabled={requires2FA}
                  className={cn(
                    "w-full bg-zinc-50 border-none rounded-2xl py-3.5 pl-11 pr-4 text-sm ring-1 ring-zinc-200 focus:ring-2 focus:ring-indigo-500 transition-all dark:bg-black/20 dark:ring-white/10 dark:text-white",
                    requires2FA && "opacity-60"
                  )}
                />
              </div>
            </div>

            {/* TOTP Code Input (shown after token accepted) */}
            <AnimatePresence>
              {requires2FA && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2"
                >
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    2FA Code
                  </label>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <Shield className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                      ref={totpInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\s/g, ''))}
                      placeholder="6-digit code or backup code"
                      className="w-full bg-zinc-50 border-none rounded-2xl py-3.5 pl-11 pr-4 text-sm ring-1 ring-zinc-200 focus:ring-2 focus:ring-indigo-500 transition-all dark:bg-black/20 dark:ring-white/10 dark:text-white font-mono tracking-widest"
                    />
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Enter the code from your authenticator app or a backup code.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-500/20"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !token || (requires2FA && !totpCode)}
              className={cn(
                "group relative w-full overflow-hidden rounded-2xl bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200",
                loading && "pl-12"
              )}
            >
              <div className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {requires2FA ? 'Verify' : 'Sign in'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </div>
            </button>
          </form>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center text-xs text-zinc-400 leading-relaxed dark:text-zinc-500"
        >
          {requires2FA ? (
            <>Enter the 6-digit code from your authenticator app.</>
          ) : (
            <>Check your terminal for the admin token.<br />
            It was generated when the server started.</>
          )}
        </motion.p>
      </motion.div>
    </div>
  );
}
