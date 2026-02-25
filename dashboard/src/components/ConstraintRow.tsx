import { Select } from './catalyst/select';
import { Input } from './catalyst/input';
import { X } from 'lucide-react';
import type { ConstraintFormState } from '../lib/policy-yaml';
import type { ProviderReference } from '../types';

interface Props {
  constraint: ConstraintFormState;
  fields: string[];
  constraintRules: ProviderReference['constraints'];
  onChange: (updated: ConstraintFormState) => void;
  onRemove: () => void;
}

const PLACEHOLDER: Record<string, string> = {
  must_match: 'regex pattern',
  must_be_one_of: 'value1, value2, ...',
  must_equal: 'value',
};

export function ConstraintRow({ constraint, fields, constraintRules, onChange, onRemove }: Props) {
  const rule = constraintRules.find(r => r.rule === constraint.rule);
  const showValue = rule ? rule.requiresValue : constraint.rule !== 'must_not_be_empty';

  // Build field options — include current value if not in list
  const fieldOptions = fields.includes(constraint.field)
    ? fields
    : constraint.field ? [constraint.field, ...fields] : fields;

  return (
    <div className="flex items-center gap-2">
      <div className="w-40 shrink-0">
        <Select
          value={constraint.field}
          onChange={e => onChange({ ...constraint, field: e.target.value })}
        >
          <option value="">field...</option>
          {fieldOptions.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>
      </div>
      <div className="w-44 shrink-0">
        <Select
          value={constraint.rule}
          onChange={e => onChange({ ...constraint, rule: e.target.value })}
        >
          <option value="">rule...</option>
          {constraintRules.map(c => (
            <option key={c.rule} value={c.rule}>{c.rule}</option>
          ))}
        </Select>
      </div>
      {showValue && (
        <div className="min-w-0 flex-1">
          <Input
            value={constraint.value}
            onChange={e => onChange({ ...constraint, value: e.target.value })}
            placeholder={PLACEHOLDER[constraint.rule] ?? 'value'}
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
