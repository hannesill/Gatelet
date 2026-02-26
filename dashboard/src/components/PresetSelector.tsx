import { Eye, Layers, Zap } from 'lucide-react';
import { cn } from '../utils';

const PRESET_META: Record<string, { label: string; icon: typeof Eye; description: string }> = {
  'read-only': {
    label: 'Read Only',
    icon: Eye,
    description: 'Search and view only — no sending, creating, or modifying.',
  },
  'standard': {
    label: 'Standard',
    icon: Layers,
    description: 'Read access with safe writes — send and reply disabled by default.',
  },
  'full-access': {
    label: 'Full Access',
    icon: Zap,
    description: 'All operations enabled with safety guards retained.',
  },
};

interface Props {
  presets: string[];
  active: string | null;
  onSelect: (preset: string) => void;
  compact?: boolean;
}

export function PresetSelector({ presets, active, onSelect, compact }: Props) {
  return (
    <div className={cn('flex gap-2', compact ? 'flex-wrap' : 'flex-col sm:flex-row')}>
      {presets.map((preset) => {
        const meta = PRESET_META[preset];
        if (!meta) return null;
        const Icon = meta.icon;
        const isActive = active === preset;

        return (
          <button
            key={preset}
            type="button"
            onClick={() => onSelect(preset)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
              compact ? 'flex-1 min-w-0 justify-center' : '',
              isActive
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
      {active === null && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-600 dark:text-zinc-500">
          Custom
        </div>
      )}
    </div>
  );
}
