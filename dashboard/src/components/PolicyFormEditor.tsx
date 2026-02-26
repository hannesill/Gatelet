import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './catalyst/button';
import { Badge } from './catalyst/badge';
import { OperationPolicyCard } from './OperationPolicyCard';
import { PolicyEditor } from './PolicyEditor';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import { Plus } from 'lucide-react';
import {
  parsePolicyYaml,
  stringifyPolicyYaml,
  configToFormState,
  formStateToConfig,
} from '../lib/policy-yaml';
import type { PolicyFormState, OperationFormState } from '../lib/policy-yaml';
import type { PolicyValidation } from '../types';
import { PresetSelector } from './PresetSelector';
import { detectPreset } from '../lib/preset-detection';

interface Props {
  connectionId: string;
  providerId: string;
  accountName: string;
  onClose: () => void;
  onSaved: () => void;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}

export function PolicyFormEditor({ connectionId, providerId, accountName, onClose, onSaved }: Props) {
  const { data: initialYaml } = useApi(() => api.getPolicy(connectionId), [connectionId]);
  const { data: providerRef } = useApi(() => api.getProviderReference(providerId), [providerId]);
  const { toast } = useToast();

  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [formState, setFormState] = useState<PolicyFormState | null>(null);
  const [yamlText, setYamlText] = useState('');
  const [validation, setValidation] = useState<PolicyValidation | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [presetYamls, setPresetYamls] = useState<Record<string, string> | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Track last validated YAML to avoid redundant validation calls
  const lastValidatedRef = useRef('');
  const validateTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch preset YAMLs when provider reference loads
  useEffect(() => {
    if (!providerRef?.presets?.length) return;
    let cancelled = false;
    Promise.all(
      providerRef.presets.map(async (name) => {
        const yaml = await api.getProviderPreset(providerId, name);
        return [name, yaml] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setPresetYamls(Object.fromEntries(entries));
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [providerRef, providerId]);

  // Initialize from loaded YAML
  useEffect(() => {
    if (!initialYaml) return;
    setYamlText(initialYaml);
    try {
      const config = parsePolicyYaml(initialYaml);
      setFormState(configToFormState(config));
    } catch {
      // YAML couldn't be parsed into form — fall back to YAML mode
      setMode('yaml');
      setFormState(null);
    }
  }, [initialYaml]);

  // Debounced validation
  const currentYaml = useCallback(() => {
    if (mode === 'yaml') return yamlText;
    if (!formState) return '';
    try {
      return stringifyPolicyYaml(formStateToConfig(formState));
    } catch {
      return '';
    }
  }, [mode, yamlText, formState]);

  useEffect(() => {
    const yaml = currentYaml();
    if (!yaml || yaml === lastValidatedRef.current) return;

    clearTimeout(validateTimerRef.current);
    validateTimerRef.current = setTimeout(async () => {
      lastValidatedRef.current = yaml;
      try {
        const res = await api.validatePolicy(connectionId, yaml);
        setValidation(res);
      } catch {
        // ignore
      }
    }, 500);

    return () => clearTimeout(validateTimerRef.current);
  }, [currentYaml, connectionId]);

  // Detect active preset when YAML or presets change
  useEffect(() => {
    if (!presetYamls) return;
    const yaml = currentYaml();
    if (!yaml) { setActivePreset(null); return; }
    setActivePreset(detectPreset(yaml, presetYamls));
  }, [currentYaml, presetYamls]);

  function handleSwitchToYaml() {
    if (!formState) return;
    try {
      const yaml = stringifyPolicyYaml(formStateToConfig(formState));
      setYamlText(yaml);
      setMode('yaml');
      setModeError(null);
    } catch (e: any) {
      setModeError(e.message);
    }
  }

  function handleSwitchToForm() {
    try {
      const config = parsePolicyYaml(yamlText);
      setFormState(configToFormState(config));
      setMode('form');
      setModeError(null);
    } catch (e: any) {
      setModeError(`Cannot switch to form: ${e.message}`);
    }
  }

  function handlePresetSelect(preset: string) {
    if (!presetYamls?.[preset]) return;
    const resolved = presetYamls[preset].replace('{account}', accountName);
    setYamlText(resolved);
    try {
      const config = parsePolicyYaml(resolved);
      setFormState(configToFormState(config));
    } catch {
      // fall back to YAML mode
      setMode('yaml');
      setFormState(null);
    }
    setDirty(true);
    setActivePreset(preset);
  }

  function updateOperation(index: number, updated: OperationFormState) {
    if (!formState) return;
    const operations = [...formState.operations];
    operations[index] = updated;
    setFormState({ ...formState, operations });
    setDirty(true);
  }

  function removeOperation(index: number) {
    if (!formState) return;
    setFormState({ ...formState, operations: formState.operations.filter((_, i) => i !== index) });
    setDirty(true);
  }

  function addOperation(name: string) {
    if (!formState) return;
    const newOp: OperationFormState = {
      name,
      allow: false,
      constraints: [],
      mutations: [],
      guards: '',
      guardsParseError: null,
      fieldFilterMode: 'none',
      allowed_fields: [],
      denied_fields: [],
    };
    setFormState({ ...formState, operations: [...formState.operations, newOp] });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      let yaml: string;
      if (mode === 'yaml') {
        yaml = yamlText;
      } else if (formState) {
        yaml = stringifyPolicyYaml(formStateToConfig(formState));
      } else {
        toast('No policy data to save', 'error');
        setSaving(false);
        return;
      }

      const res = await api.savePolicy(connectionId, yaml);
      if (res.updated) {
        const enabled = res.tools?.enabled?.length ?? 0;
        toast(`Policy saved. ${enabled} tools enabled.`);
        onSaved();
        onClose();
      } else {
        toast(res.error || 'Save failed', 'error');
      }
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // Loading state
  if (!initialYaml || !providerRef) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    );
  }

  // Unlisted operations (from provider ref, not in current form state)
  const listedOps = new Set(formState?.operations.map(o => o.name) ?? []);
  const unlistedOps = providerRef.operations.filter(o => !listedOps.has(o.policyOperation));

  return (
    <div>
      {/* Preset selector */}
      {providerRef.presets && providerRef.presets.length > 0 && presetYamls && (
        <div className="mb-4">
          <PresetSelector
            presets={providerRef.presets}
            active={activePreset}
            onSelect={handlePresetSelect}
          />
        </div>
      )}

      {/* Mode toggle tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5">
        <button
          type="button"
          onClick={mode === 'yaml' ? handleSwitchToForm : undefined}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'form'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          Form
        </button>
        <button
          type="button"
          onClick={mode === 'form' ? handleSwitchToYaml : undefined}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'yaml'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          YAML
        </button>
      </div>

      {modeError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-500/20">
          <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{modeError}</p>
        </div>
      )}

      {/* Form mode */}
      {mode === 'form' && formState && (
        <div className="space-y-3">
          {formState.operations.map((op, i) => {
            const refOp = providerRef.operations.find(r => r.policyOperation === op.name);
            const fields = refOp?.fields ?? [];
            return (
              <OperationPolicyCard
                key={op.name}
                operation={op}
                providerRef={providerRef}
                operationFields={fields}
                onChange={updated => updateOperation(i, updated)}
                onRemove={() => removeOperation(i)}
              />
            );
          })}

          {/* Unlisted operations */}
          {unlistedOps.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-500">
                Not listed (denied by default):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unlistedOps.map(op => (
                  <button
                    key={op.policyOperation}
                    type="button"
                    onClick={() => addOperation(op.policyOperation)}
                    className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
                  >
                    <Plus className="h-3 w-3" />
                    {op.policyOperation}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* YAML mode — reuse existing PolicyEditor as inner component */}
      {mode === 'yaml' && (
        <PolicyEditor
          connectionId={connectionId}
          providerId={providerId}
          onClose={onClose}
          onSaved={onSaved}
          embedded
          externalYaml={yamlText}
          onYamlChange={(v: string) => { setYamlText(v); setDirty(true); }}
        />
      )}

      {/* Validation feedback — only shown in form mode (YAML mode has its own) */}
      {mode === 'form' && validation && !validation.valid && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-500/20">
          <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{validation.error}</p>
        </div>
      )}
      {mode === 'form' && validation?.valid && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-500/20">
            <CheckIcon className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-600 dark:text-green-400">
              Valid &mdash; {validation.tools?.filter(t => t.enabled).length} of {validation.tools?.length} tools enabled
            </p>
          </div>
          {validation.warnings && validation.warnings.length > 0 && (
            <div className="space-y-1">
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-yellow-50 px-3 py-2 ring-1 ring-yellow-200 dark:bg-yellow-950/30 dark:ring-yellow-500/20">
                  <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">{w}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons — only in form mode (YAML mode has its own save/cancel) */}
      {mode === 'form' && (
        <div className="mt-5 flex items-center gap-3">
          <Button color="indigo" onClick={save} disabled={saving || (validation ? !validation.valid : false)}>
            {saving ? 'Saving...' : 'Save Policy'}
          </Button>
          <Button plain onClick={onClose}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
