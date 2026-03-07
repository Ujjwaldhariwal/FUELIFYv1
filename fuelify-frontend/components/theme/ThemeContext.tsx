// fuelify-frontend/components/theme/ThemeContext.tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'fuelify_theme';

const applyThemeClass = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === 'light' ? 'light' : 'dark';
    setThemeState(initial);
    applyThemeClass(initial);
    setMounted(true);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyThemeClass(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {mounted && <ThemeToggleButton theme={theme} onToggle={toggleTheme} />}
    </ThemeContext.Provider>
  );
};

const ThemeToggleButton = ({ theme, onToggle }: { theme: Theme; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    className={[
      'fixed right-4 top-4 z-[1200]',
      'flex h-10 w-10 items-center justify-center rounded-full',
      'border border-[var(--border-strong)] bg-[var(--bg-surface)]',
      'text-[var(--text-secondary)]',
      'shadow-[0_2px_12px_rgba(0,0,0,0.15)]',
      'transition-all duration-300',
      'hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.28)]',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
      'active:scale-90',
      'sm:right-5 sm:top-5',
    ].join(' ')}
  >
    {theme === 'dark'
      ? <Sun  className="h-4 w-4 transition-transform duration-300" />
      : <Moon className="h-4 w-4 transition-transform duration-300" />}
  </button>
);

export const useTheme = () => useContext(ThemeContext);
