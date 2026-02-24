import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { Button } from './catalyst/button';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import type { PolicyValidation, ProviderReference } from '../types';

interface Props {
  connectionId: string;
  providerId: string;
  onClose: () => void;
  onSaved: () => void;
}

function PolicyReference({ providerId }: { providerId: string }) {
  const { data } = useApi(() => api.getProviderReference(providerId), [providerId]);
  if (!data) return null;

  return (
    <div className="space-y-5 text-xs">
      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Operations</h4>
        <div className="space-y-1">
          {data.operations.map(op => (
            <div key={op.name}>
              <code className="text-zinc-700 dark:text-zinc-300">{op.policyOperation}</code>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Constraints</h4>
        <div className="space-y-1">
          {data.constraints.map(c => (
            <div key={c.rule}>
              <code className="text-zinc-700 dark:text-zinc-300">{c.rule}</code>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Mutations</h4>
        <div className="space-y-1">
          {data.mutations.map(m => (
            <div key={m.action}>
              <code className="text-zinc-700 dark:text-zinc-300">{m.action}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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

export function PolicyEditor({ connectionId, providerId, onClose, onSaved }: Props) {
  const { data: initialYaml } = useApi(() => api.getPolicy(connectionId), [connectionId]);
  const [value, setValue] = useState('');
  const [validation, setValidation] = useState<PolicyValidation | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { resolved } = useTheme();

  useEffect(() => {
    if (initialYaml) setValue(initialYaml);
  }, [initialYaml]);

  useEffect(() => {
    if (!value) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await api.validatePolicy(connectionId, value);
        setValidation(res);
      } catch {
        // Ignore validation errors during editing
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [value, connectionId]);

  async function save() {
    setSaving(true);
    try {
      const res = await api.savePolicy(connectionId, value);
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

  if (!initialYaml) {
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

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <CodeMirror
            value={value}
            onChange={setValue}
            extensions={[yaml()]}
            theme={resolved}
            className="overflow-hidden rounded-lg ring-1 ring-zinc-950/10 text-sm dark:ring-white/10 [&_.cm-editor]:!bg-white dark:[&_.cm-editor]:!bg-zinc-900"
            minHeight="200px"
          />

          {/* Validation feedback */}
          {validation && !validation.valid && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-500/20">
              <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400">{validation.error}</p>
            </div>
          )}
          {validation?.valid && (
            <div className="space-y-2">
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
        </div>

        {/* Reference panel */}
        <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-zinc-800/40 dark:ring-white/5">
          <h4 className="mb-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">Reference</h4>
          <PolicyReference providerId={providerId} />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button color="amber" onClick={save} disabled={saving || (validation ? !validation.valid : false)}>
          {saving ? 'Saving...' : 'Save Policy'}
        </Button>
        <Button plain onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
