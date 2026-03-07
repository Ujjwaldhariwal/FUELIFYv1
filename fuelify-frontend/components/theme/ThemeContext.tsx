//app/components/theme/ThemeContext.tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === 'light' ? 'light' : 'dark';
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyThemeClass(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);