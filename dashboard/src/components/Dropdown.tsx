import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../utils';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  icon?: React.ReactNode;
  className?: string;
}

export function Dropdown({ value, onChange, options, icon, className }: DropdownProps) {
  const selected = options.find(o => o.value === value);

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={cn("relative", className)}>
        <ListboxButton
          className={cn(
            "flex items-center gap-1.5 bg-transparent text-xs font-semibold py-1.5 px-1 cursor-pointer",
            "text-zinc-700 dark:text-zinc-300",
            "hover:text-zinc-900 dark:hover:text-white",
            "focus:outline-none transition-colors",
          )}
        >
          {icon}
          <span>{selected?.label ?? ''}</span>
          <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform duration-200 ui-open:rotate-180" />
        </ListboxButton>

        <ListboxOptions
          anchor="bottom start"
          transition
          className={cn(
            "z-50 mt-1.5 min-w-[10rem] rounded-xl p-1",
            "bg-white ring-1 ring-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
            "dark:bg-zinc-900 dark:ring-white/10 dark:shadow-[0_15px_40px_rgb(0,0,0,0.5)]",
            "origin-top transition duration-150 ease-out",
            "data-[closed]:scale-95 data-[closed]:opacity-0",
          )}
        >
          {options.map(opt => (
            <ListboxOption
              key={opt.value}
              value={opt.value}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer select-none",
                "text-zinc-700 dark:text-zinc-300",
                "data-[focus]:bg-zinc-100 dark:data-[focus]:bg-white/5",
                "data-[selected]:text-zinc-900 dark:data-[selected]:text-white",
              )}
            >
              <Check className="h-3.5 w-3.5 opacity-0 ui-selected:opacity-100 text-amber-500 shrink-0" />
              {opt.label}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
