import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '../utils';

export function ThemeToggle() {
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (stored) setThemeState(stored);
  }, []);

  function setTheme(t: 'light' | 'dark' | 'system') {
    setThemeState(t);
    if (t === 'system') {
      localStorage.removeItem('theme');
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
    } else {
      localStorage.setItem('theme', t);
      document.documentElement.classList.toggle('dark', t === 'dark');
    }
  }

  const options = [
    { value: 'light' as const, icon: Sun },
    { value: 'dark' as const, icon: Moon },
    { value: 'system' as const, icon: Monitor },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-white/60 p-1 ring-1 ring-zinc-900/5 backdrop-blur-sm dark:bg-white/5 dark:ring-white/10">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={cn(
            'relative cursor-pointer rounded-full p-1.5 transition-colors duration-200',
            theme === opt.value
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
          )}
        >
          {theme === opt.value && (
            <motion.div
              layoutId="website-theme-pill"
              className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-white/10"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <opt.icon className="relative z-10 h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
