import { Eye, Layers, Zap, Pencil } from 'lucide-react';
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
  if (compact) {
    return (
      <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-white/5">
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
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{meta.label}</span>
            </button>
          );
        })}
        <div
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 cursor-not-allowed dark:text-zinc-600"
          title="Customize policies in the dashboard after setup"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span>Custom</span>
        </div>
      </div>
    );
  }

  // Dashboard (non-compact) mode: icon + label buttons in a row, description as subtitle
  const activeDescription = active
    ? PRESET_META[active]?.description
    : null;

  return (
    <div>
      <div className="flex flex-row flex-wrap gap-2">
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
      {activeDescription && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{activeDescription}</p>
      )}
    </div>
  );
}
