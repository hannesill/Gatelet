import { useState } from 'react';
import { Button } from '../components/catalyst/button';
import { Input } from '../components/catalyst/input';
import { Field, Label } from '../components/catalyst/fieldset';
import { AgentConfig } from '../components/AgentConfig';
import { OAuthButton } from '../components/OAuthButton';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import type { OAuthProvider } from '../types';
import clsx from 'clsx';

interface Props {
  oauthProviders: OAuthProvider[];
  onComplete: () => void;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z" clipRule="evenodd" />
    </svg>
  );
}

function StepIndicator({ current }: { current: number }) {
  const steps = ['Create API Key', 'Connect Account', 'Configure Agent'];
  return (
    <div className="flex items-center">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          {i > 0 && (
            <div className={clsx('mx-3 h-px w-12 sm:w-16', i < current ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700')} />
          )}
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors',
              i + 1 < current
                ? 'bg-blue-600 text-white'
                : i + 1 === current
                  ? 'bg-blue-600 text-white ring-2 ring-blue-600/30'
                  : 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-white/10',
            )}>
              {i + 1 < current ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={clsx(
              'hidden text-xs font-medium sm:block',
              i + 1 <= current ? 'text-zinc-900 dark:text-white' : 'text-zinc-500',
            )}>
              {label}
            </span>
          </div>
        </div>
      ))}
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
      toast('API key created');
      setStep(2);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center px-4 pt-16 sm:pt-24">
      <div className="w-full max-w-lg">
        {/* Branding */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/20">
            <ShieldIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">Gatelet Setup</span>
            <p className="text-xs text-zinc-500">Get started in three steps</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <StepIndicator current={step} />
        </div>

        {/* Step content */}
        <div className="rounded-xl bg-white p-6 ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
          {step === 1 && (
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Create an API Key</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Your agent authenticates with Gatelet using an API key.
              </p>
              <div className="mt-5 space-y-4">
                <Field>
                  <Label>Key name</Label>
                  <Input
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    placeholder="e.g. My Agent"
                    onKeyDown={e => e.key === 'Enter' && createKey()}
                    autoFocus
                  />
                </Field>
                <Button color="blue" onClick={createKey} disabled={creating || !keyName.trim()}>
                  {creating ? 'Creating...' : 'Create Key'}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Connect an Account</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Connect a service so your agent can access it through Gatelet.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                {oauthProviders.map(p => (
                  <OAuthButton key={p.id} provider={p} />
                ))}
              </div>
              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-white/5">
                <button
                  onClick={() => setStep(3)}
                  className="text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Skip for now &rarr;
                </button>
              </div>
            </div>
          )}

          {step === 3 && createdKey && (
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Configure Your Agent</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Add this to your agent's MCP configuration:
              </p>
              <div className="mt-5">
                <AgentConfig apiKey={createdKey} />
              </div>
              <Button color="blue" onClick={onComplete} className="mt-2">
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
