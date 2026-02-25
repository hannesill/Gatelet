import { useState } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import { ConstraintRow } from './ConstraintRow';
import { MutationRow } from './MutationRow';
import type { OperationFormState, ConstraintFormState, MutationFormState } from '../lib/policy-yaml';
import type { ProviderReference } from '../types';

interface Props {
  operation: OperationFormState;
  providerRef: ProviderReference;
  operationFields: string[];
  onChange: (updated: OperationFormState) => void;
  onRemove: () => void;
}

export function OperationPolicyCard({ operation, providerRef, operationFields, onChange, onRemove }: Props) {
  const [showFieldFilter, setShowFieldFilter] = useState(operation.fieldFilterMode !== 'none');
  const [showGuards, setShowGuards] = useState(operation.guards.trim().length > 0);

  function updateConstraint(index: number, updated: ConstraintFormState) {
    const constraints = [...operation.constraints];
    constraints[index] = updated;
    onChange({ ...operation, constraints });
  }

  function removeConstraint(index: number) {
    onChange({ ...operation, constraints: operation.constraints.filter((_, i) => i !== index) });
  }

  function addConstraint() {
    onChange({
      ...operation,
      constraints: [
        ...operation.constraints,
        { id: crypto.randomUUID(), field: '', rule: '', value: '' },
      ],
    });
  }

  function updateMutation(index: number, updated: MutationFormState) {
    const mutations = [...operation.mutations];
    mutations[index] = updated;
    onChange({ ...operation, mutations });
  }

  function removeMutation(index: number) {
    onChange({ ...operation, mutations: operation.mutations.filter((_, i) => i !== index) });
  }

  function addMutation() {
    onChange({
      ...operation,
      mutations: [
        ...operation.mutations,
        { id: crypto.randomUUID(), field: '', action: '', value: '' },
      ],
    });
  }

  function handleFieldFilterModeChange(mode: 'none' | 'allowed' | 'denied') {
    onChange({ ...operation, fieldFilterMode: mode });
  }

  function handleFieldToggle(field: string, list: 'allowed_fields' | 'denied_fields') {
    const current = [...operation[list]];
    const idx = current.indexOf(field);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(field);
    onChange({ ...operation, [list]: current });
  }

  function handleGuardsChange(value: string) {
    let guardsParseError: string | null = null;
    if (value.trim()) {
      try {
        JSON.parse(value);
      } catch (e: any) {
        guardsParseError = e.message;
      }
    }
    onChange({ ...operation, guards: value, guardsParseError });
  }

  return (
    <div className="rounded-lg bg-white ring-1 ring-zinc-950/5 dark:bg-zinc-800/60 dark:ring-white/5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <code className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{operation.name}</code>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange({ ...operation, allow: true })}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                operation.allow
                  ? 'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              allow
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...operation, allow: false })}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                !operation.allow
                  ? 'bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              deny
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/5 dark:hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body — visible sections */}
      <div className="space-y-4 border-t border-zinc-100 px-4 py-3 dark:border-white/5">
        {/* Constraints */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Constraints
          </h4>
          <div className="space-y-2">
            {operation.constraints.map((c, i) => (
              <ConstraintRow
                key={c.id}
                constraint={c}
                fields={operationFields}
                constraintRules={providerRef.constraints}
                onChange={updated => updateConstraint(i, updated)}
                onRemove={() => removeConstraint(i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addConstraint}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Add constraint
          </button>
        </div>

        {/* Mutations */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Mutations
          </h4>
          <div className="space-y-2">
            {operation.mutations.map((m, i) => (
              <MutationRow
                key={m.id}
                mutation={m}
                fields={operationFields}
                mutationActions={providerRef.mutations}
                onChange={updated => updateMutation(i, updated)}
                onRemove={() => removeMutation(i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addMutation}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Add mutation
          </button>
        </div>

        {/* Field Filtering — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setShowFieldFilter(!showFieldFilter)}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFieldFilter ? 'rotate-0' : '-rotate-90'}`} />
            Field Filtering
          </button>
          {showFieldFilter && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-3">
                {(['none', 'allowed', 'denied'] as const).map(mode => (
                  <label key={mode} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                          <input
                                            type="radio"
                                            name={`fieldFilter-${operation.name}`}
                                            checked={operation.fieldFilterMode === mode}
                                            onChange={() => handleFieldFilterModeChange(mode)}
                                            className="accent-indigo-500"
                                          />
                                          {mode === 'none' ? 'None' : mode === 'allowed' ? 'Allowed fields' : 'Denied fields'}
                                        </label>
                                      ))}
                                    </div>
                                    {operation.fieldFilterMode !== 'none' && (
                                      <div className="flex flex-wrap gap-2">
                                        {operationFields.map(field => {
                                          const list = operation.fieldFilterMode === 'allowed' ? 'allowed_fields' : 'denied_fields';
                                          const checked = operation[list].includes(field);
                                          return (
                                            <label key={field} className="flex items-center gap-1.5 rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => handleFieldToggle(field, list)}
                                                className="accent-indigo-500"
                                              />
                                              {field}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                    
                              {/* Guards — collapsible */}
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setShowGuards(!showGuards)}
                                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                                >
                                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showGuards ? 'rotate-0' : '-rotate-90'}`} />
                                  Guards
                                </button>
                                {showGuards && (
                                  <div className="mt-2">
                                    <textarea
                                      value={operation.guards}
                                      onChange={e => handleGuardsChange(e.target.value)}
                                      placeholder='{"block_subjects": ["password reset"]}'
                                      rows={6}
                                      className="w-full rounded-lg border border-zinc-950/10 bg-transparent px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                    />
                                    {operation.guardsParseError && (
                                      <p className="mt-1 text-xs text-red-500 dark:text-red-400">{operation.guardsParseError}</p>
                                    )}
                                  </div>
                                )}
                              </div>      </div>
    </div>
  );
}
