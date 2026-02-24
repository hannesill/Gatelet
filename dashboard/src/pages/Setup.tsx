import { useState } from 'react';
import { AgentConfig } from '../components/AgentConfig';
import { OAuthButton } from '../components/OAuthButton';
import { Logo } from '../components/Logo';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  ArrowRight, 
  Check, 
  Plus, 
  Settings, 
  Sparkles,
  Link2,
  ChevronRight
} from 'lucide-react';

import type { OAuthProvider } from '../types';

interface Props {
  oauthProviders: OAuthProvider[];
  onComplete: () => void;
}

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { label: 'Identity', icon: Key },
    { label: 'Connect', icon: Link2 },
    { label: 'Integrate', icon: Settings },
  ];
  
  return (
    <div className="flex items-center gap-4 px-2">
      {steps.map((s, i) => {
        const active = i + 1 === current;
        const completed = i + 1 < current;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-500",
              active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110" : 
              completed ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400 dark:bg-white/5"
            )}>
              {completed ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "h-0.5 w-6 rounded-full transition-all duration-500",
                completed ? "bg-emerald-500" : "bg-zinc-100 dark:bg-white/5"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Setup({ oauthProviders, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  async function createKey() {
    if (!keyName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createApiKey(keyName.trim());
      setCreatedKey(res.key);
      toast('API key generated');
      setStep(2);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="login-gradient relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Visual background elements */}
      <div className="absolute top-0 left-0 h-full w-full pointer-events-none">
        <div className="absolute -top-48 -left-48 h-[600px] w-[600px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute top-1/2 -right-48 h-[600px] w-[600px] rounded-full bg-zinc-500/5 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-xl"
      >
        {/* Header */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 shadow-2xl dark:bg-white">
            <Logo className="h-8 w-8 text-white dark:text-zinc-950" />
          </div>
          <h1 className="font-[Fraunces] text-3xl italic text-zinc-900 dark:text-white">Initialize Gatelet</h1>
          <p className="mt-2 text-zinc-500">Securely bridge your AI agents to real-world data</p>
          
          <div className="mt-8">
            <StepIndicator current={step} />
          </div>
        </div>

        {/* Card Content */}
        <div className="overflow-hidden rounded-[32px] bg-white/80 p-8 shadow-2xl shadow-zinc-950/5 ring-1 ring-zinc-200 backdrop-blur-xl dark:bg-zinc-900/80 dark:shadow-black/40 dark:ring-white/10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Name your Agent</h2>
                  <p className="mt-1 text-sm text-zinc-500">Choose a name to identify this connection.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="group relative">
                    <input
                      value={keyName}
                      onChange={e => setKeyName(e.target.value)}
                      placeholder="e.g. My Primary Agent"
                      className="w-full bg-zinc-50 border-none rounded-2xl py-4 px-6 text-sm ring-1 ring-zinc-200 focus:ring-2 focus:ring-indigo-500 transition-all dark:bg-black/20 dark:ring-white/10 dark:text-white"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && createKey()}
                    />
                  </div>
                  <button
                    onClick={createKey}
                    disabled={creating || !keyName.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {creating ? "Generating..." : "Generate API Key"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Connect Services</h2>
                  <p className="mt-1 text-sm text-zinc-500">Grant your agent access to your accounts.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {oauthProviders.map(p => (
                    <OAuthButton key={p.id} provider={p} />
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-white/5">
                  <p className="text-xs text-zinc-400">You can add more services later.</p>
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && createdKey && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Complete Integration</h2>
                  <p className="mt-1 text-sm text-zinc-500">Paste this configuration into your agent settings.</p>
                </div>

                <AgentConfig apiKey={createdKey} />

                <button
                  onClick={onComplete}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  <Sparkles className="h-4 w-4" />
                  Launch Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500"
        >
          Need help? <a href="https://github.com/hannesill/gatelet" className="text-indigo-600 underline">View Documentation</a>
        </motion.p>
      </motion.div>
    </div>
  );
}
