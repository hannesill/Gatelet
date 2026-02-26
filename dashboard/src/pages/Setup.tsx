import { useState, useEffect } from 'react';
import { AgentConfig } from '../components/AgentConfig';
import { OAuthButton } from '../components/OAuthButton';
import { PresetSelector } from '../components/PresetSelector';
import { TestConnectionButton } from '../components/TestConnectionButton';
import { DynamicBackground } from '../components/DynamicBackground';
import { ThemeToggle } from '../components/ThemeToggle';
import { detectPreset } from '../lib/preset-detection';
import { Logo } from '../components/Logo';
import { GmailLogo, GoogleCalendarLogo, OutlookCalendarLogo } from '../components/ProviderLogos';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { cn } from '../utils';
import {
  Key,
  ArrowRight,
  Check,
  Sparkles,
  Link2,
  ChevronRight,
  Copy,
  Fingerprint,
  MessageSquare,
} from 'lucide-react';

import type { OAuthProvider, ConnectionWithMeta } from '../types';

const SETUP_PROVIDER_ICONS: Record<string, any> = {
  google_gmail: GmailLogo,
  google_calendar: GoogleCalendarLogo,
  outlook_calendar: OutlookCalendarLogo,
};

interface ConnectionPresetState {
  presets: string[];
  yamls: Record<string, string>;
  active: string | null;
}

interface Props {
  oauthProviders: OAuthProvider[];
  connections: ConnectionWithMeta[];
  runtime?: { docker: boolean };
  onComplete: () => void;
  onRefresh: () => void;
}

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { label: 'Connect', icon: Link2 },
    { label: 'Agent', icon: Key },
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

function TryItCard({ connections }: { connections: ConnectionWithMeta[] }) {
  const [copied, setCopied] = useState(false);

  const providerIds = new Set(connections.map(c => c.provider_id));
  const hasCalendar = providerIds.has('google_calendar') || providerIds.has('outlook_calendar');
  const hasGmail = providerIds.has('google_gmail');

  // Calendar prompt is shorter / quicker feedback loop, so prioritize it
  let prompt: string;
  if (hasCalendar) {
    prompt = "What's on my calendar for today?";
  } else if (hasGmail) {
    prompt = 'Check my inbox and summarize the 3 most recent unread emails.';
  } else {
    return null;
  }

  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-200 dark:bg-indigo-950/20 dark:ring-indigo-500/30">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Try it out</h4>
          <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-400/80">
            Paste this into your agent to verify everything works end-to-end.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 rounded-xl bg-white/50 px-3 py-2.5 text-xs font-medium text-indigo-900 ring-1 ring-indigo-200 dark:bg-black/20 dark:text-indigo-100 dark:ring-indigo-500/20">
              {prompt}
            </code>
            <button
              onClick={handleCopy}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Setup({ oauthProviders, connections, runtime, onComplete, onRefresh }: Props) {
  const [step, setStep] = useState(1);
  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyGenerated, setKeyGenerated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [connectionPresets, setConnectionPresets] = useState<Record<string, ConnectionPresetState>>({});
  const [setupReady, setSetupReady] = useState(false);
  const { toast } = useToast();

  // Mark setup as in-progress so OAuth redirects preserve the wizard
  useEffect(() => {
    let cancelled = false;
    api.startSetup().then(() => {
      if (!cancelled) setSetupReady(true);
    }).catch(() => {
      // Even on failure, unblock the UI so the user isn't stuck
      if (!cancelled) setSetupReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Fetch presets for each connection
  useEffect(() => {
    if (connections.length === 0) return;
    let cancelled = false;

    async function load() {
      const result: Record<string, ConnectionPresetState> = {};
      for (const conn of connections) {
        try {
          const ref = await api.getProviderReference(conn.provider_id);
          if (!ref.presets?.length) continue;
          const entries = await Promise.all(
            ref.presets.map(async (name) => {
              const yaml = await api.getProviderPreset(conn.provider_id, name);
              return [name, yaml] as const;
            }),
          );
          const yamls = Object.fromEntries(entries);
          let active = detectPreset(conn.policy_yaml, yamls);

          // Default new connections to read-only (conservative for new users)
          if (active === 'standard' && yamls['read-only']) {
            const resolvedYaml = yamls['read-only'].replace('{account}', conn.account_name);
            try {
              await api.savePolicy(conn.id, resolvedYaml);
              active = 'read-only';
            } catch { /* keep standard if save fails */ }
          }

          result[conn.id] = { presets: ref.presets, yamls, active };
        } catch { /* ignore */ }
      }
      if (!cancelled) setConnectionPresets(result);
    }

    load();
    return () => { cancelled = true; };
  }, [connections]);

  async function handleSetupPresetChange(connectionId: string, preset: string) {
    const state = connectionPresets[connectionId];
    if (!state?.yamls[preset]) return;
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;
    const resolvedYaml = state.yamls[preset].replace('{account}', conn.account_name);
    try {
      await api.savePolicy(connectionId, resolvedYaml);
      setConnectionPresets(prev => ({
        ...prev,
        [connectionId]: { ...prev[connectionId], active: preset },
      }));
      toast(`Policy updated to ${preset.replace('-', ' ')}`);
      onRefresh();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  async function createKey() {
    if (!keyName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createApiKey(keyName.trim());
      setCreatedKey(res.key);
      setKeyGenerated(true);
      toast('API key generated');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="login-gradient relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <DynamicBackground />
      {/* Background blobs for atmosphere */}
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px]" />
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-zinc-500/10 blur-[100px]" />

      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="animate-in relative w-full max-w-xl">
        {/* Header */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-500/40 ring-4 ring-white dark:ring-zinc-950">
            <Logo className="h-9 w-9 text-white" />
          </div>
          <h1 className="font-[Fraunces] text-3xl font-bold italic text-zinc-900 dark:text-white">Initialize Gatelet</h1>
          <p className="mt-2 text-zinc-500">Securely bridge your AI agents to real-world data</p>

          <div className="mt-8">
            <StepIndicator current={step} />
          </div>
        </div>

        {/* Card Content */}
        <div className="overflow-hidden rounded-[32px] bg-white/80 p-8 shadow-2xl shadow-zinc-950/5 ring-1 ring-zinc-200 backdrop-blur-xl dark:bg-zinc-900/80 dark:shadow-black/40 dark:ring-white/10">
          {/* Step 1: Connect Services */}
          {step === 1 && (
            <div key="step1" className="animate-in space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Connect Services</h2>
                <p className="mt-1 text-sm text-zinc-500">Grant your agent access to your accounts.</p>
              </div>

              {/* Connected services with preset selectors */}
              {connections.length > 0 && (
                <div className="space-y-3">
                  {connections.map((conn) => {
                    const Icon = SETUP_PROVIDER_ICONS[conn.provider_id] ?? Link2;
                    const presetState = connectionPresets[conn.id];
                    return (
                      <div key={conn.id} className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200 dark:bg-white/5 dark:ring-white/10">
                        <div className="flex items-center gap-3 mb-3">
                          <Icon className="h-5 w-5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{conn.displayName}</p>
                            <p className="text-xs text-zinc-500 truncate">{conn.account_name}</p>
                          </div>
                          <TestConnectionButton connectionId={conn.id} compact />
                          <div className="text-xs text-zinc-400">{conn.enabledTools}/{conn.totalTools} tools</div>
                        </div>
                        {presetState && (
                          <PresetSelector
                            presets={presetState.presets}
                            active={presetState.active}
                            onSelect={(preset) => handleSetupPresetChange(conn.id, preset)}
                            compact
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {oauthProviders.map(p => (
                  <OAuthButton key={p.id} provider={p} disabled={!setupReady} />
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-white/5">
                <p className="text-xs text-zinc-400">You can add more services later.</p>
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Create & Connect Agent (name + key + config snippets) */}
          {step === 2 && !keyGenerated && (
            <div key="step2" className="animate-in space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create your Agent</h2>
                <p className="mt-1 text-sm text-zinc-500">Name your agent and generate an API key to connect it.</p>
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
            </div>
          )}

          {step === 2 && keyGenerated && createdKey && (
            <div key="step2-key" className="animate-in space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Connect your Agent</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add this MCP server config to your agent so it can reach Gatelet.
                  Pick your agent below, then click <strong>Add to Config</strong> to write it automatically — or copy the snippet and paste it into the config file yourself.
                </p>
              </div>

              <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-500/30">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-500/20">
                    <Fingerprint className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Copy this key now</h4>
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
                      For your security, it won't be shown again.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-xl bg-white/50 px-3 py-2.5 font-mono text-xs font-bold text-amber-900 ring-1 ring-amber-200 dark:bg-black/20 dark:text-amber-100 dark:ring-amber-500/20">
                        {createdKey}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(createdKey); toast('Copied to clipboard'); }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <AgentConfig apiKey={createdKey} runtime={runtime} />

              {connections.length > 0 && <TryItCard connections={connections} />}

              <div className="flex flex-col gap-3 pt-4 border-t border-zinc-100 dark:border-white/5">
                <button
                  onClick={onComplete}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  <Sparkles className="h-4 w-4" />
                  Launch Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="animate-fade stagger-5 mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Need help? <a href="https://github.com/hannesill/gatelet" className="text-indigo-600 underline">View Documentation</a>
        </p>
      </div>
    </div>
  );
}
