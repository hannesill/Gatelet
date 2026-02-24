import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'system' | 'light' | 'dark';
type Resolved = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>(null!);

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemPreference(): Resolved {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: Resolved) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return 'system';
  });

  const resolved: Resolved = theme === 'system' ? getSystemPreference() : theme;

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (t === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', t);
    }
  }, []);

  // Apply on mount and when theme changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(getSystemPreference());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
