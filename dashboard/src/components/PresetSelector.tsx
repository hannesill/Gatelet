import { useState } from 'react';
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
  const [customHovered, setCustomHovered] = useState(false);

  if (compact) {
    return (
      <div className="flex rounded-xl bg-zinc-200/60 p-1 dark:bg-white/[0.06]">
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
                'relative flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold transition-all duration-200',
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-zinc-500 hover:bg-white/80 hover:text-zinc-800 hover:shadow-sm dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{meta.label}</span>
            </button>
          );
        })}
        <div
          className="group relative flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold text-zinc-300 cursor-default dark:text-zinc-600"
          onMouseEnter={() => setCustomHovered(true)}
          onMouseLeave={() => setCustomHovered(false)}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span>Custom</span>
          {customHovered && (
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-700 z-10">
              Available in dashboard after setup
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-zinc-800 dark:bg-zinc-700" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dashboard (non-compact) mode: segmented control with Custom always visible
  const isCustom = active === null;
  const activeDescription = active
    ? PRESET_META[active]?.description
    : 'Policy has been manually customized.';

  return (
    <div>
      <div className="flex rounded-xl bg-zinc-200/60 p-1 dark:bg-white/[0.06]">
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
                'flex flex-1 items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold transition-all duration-200',
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-zinc-500 hover:bg-white/80 hover:text-zinc-800 hover:shadow-sm dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{meta.label}</span>
            </button>
          );
        })}
        <div
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold transition-all duration-200',
            isCustom
              ? 'bg-zinc-700 text-white shadow-md dark:bg-zinc-500'
              : 'text-zinc-400 dark:text-zinc-600',
          )}
        >
          <Pencil className="h-4 w-4 shrink-0" />
          <span>Custom</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{activeDescription}</p>
    </div>
  );
}
