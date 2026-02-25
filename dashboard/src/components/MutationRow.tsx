import { Select } from './catalyst/select';
import { Input } from './catalyst/input';
import { X } from 'lucide-react';
import type { MutationFormState } from '../lib/policy-yaml';
import type { ProviderReference } from '../types';

interface Props {
  mutation: MutationFormState;
  fields: string[];
  mutationActions: ProviderReference['mutations'];
  onChange: (updated: MutationFormState) => void;
  onRemove: () => void;
}

export function MutationRow({ mutation, fields, mutationActions, onChange, onRemove }: Props) {
  const action = mutationActions.find(a => a.action === mutation.action);
  const showValue = action ? action.requiresValue : mutation.action !== 'delete';

  const fieldOptions = fields.includes(mutation.field)
    ? fields
    : mutation.field ? [mutation.field, ...fields] : fields;

  return (
    <div className="flex items-center gap-2">
      <div className="w-40 shrink-0">
        <Select
          value={mutation.field}
          onChange={e => onChange({ ...mutation, field: e.target.value })}
        >
          <option value="">field...</option>
          {fieldOptions.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>
      </div>
      <div className="w-44 shrink-0">
        <Select
          value={mutation.action}
          onChange={e => onChange({ ...mutation, action: e.target.value })}
        >
          <option value="">action...</option>
          {mutationActions.map(m => (
            <option key={m.action} value={m.action}>{m.action}</option>
          ))}
        </Select>
      </div>
      {showValue && (
        <div className="min-w-0 flex-1">
          <Input
            value={mutation.value}
            onChange={e => onChange({ ...mutation, value: e.target.value })}
            placeholder="value"
          />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/5 dark:hover:text-zinc-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
