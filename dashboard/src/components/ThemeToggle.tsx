import { useTheme } from '../hooks/useTheme';
import { cn } from '../utils';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-100/50 p-1 dark:bg-white/5 ring-1 ring-zinc-950/5 dark:ring-white/10">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className={cn(
            'relative rounded-full p-1.5 transition-all duration-200',
            theme === opt.value
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
          )}
        >
          {theme === opt.value && (
            <div className="absolute inset-0 rounded-full bg-white dark:bg-white/10 shadow-sm" />
          )}
          <opt.icon className="relative z-10 h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
