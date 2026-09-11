import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

export type OwnerTheme = 'light' | 'dark' | 'system';
export const OWNER_THEME_KEY = 'pxpress.owner.theme';
const validTheme = (value: unknown): value is OwnerTheme => value === 'light' || value === 'dark' || value === 'system';
function readTheme(): OwnerTheme {
  try { const value = localStorage.getItem(OWNER_THEME_KEY); return validTheme(value) ? value : 'system'; }
  catch { return 'system'; }
}
const ThemeContext = createContext<{
  theme: OwnerTheme; resolvedTheme: 'light' | 'dark'; storageError: string; setTheme: (theme: OwnerTheme) => void;
} | null>(null);

export function OwnerThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<OwnerTheme>(readTheme);
  const [systemDark, setSystemDark] = useState(() => typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true);
  const [storageError, setStorageError] = useState('');
  const resolvedTheme = theme === 'system' ? systemDark ? 'dark' : 'light' : theme;
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === OWNER_THEME_KEY || event.key === null) { updateTheme(readTheme()); setStorageError(''); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useLayoutEffect(() => {
    const previous = document.documentElement.dataset.ownerTheme;
    document.documentElement.dataset.ownerTheme = resolvedTheme;
    return () => {
      if (previous === undefined) delete document.documentElement.dataset.ownerTheme;
      else document.documentElement.dataset.ownerTheme = previous;
    };
  }, [resolvedTheme]);
  function setTheme(next: OwnerTheme) {
    updateTheme(next);
    try { localStorage.setItem(OWNER_THEME_KEY, next); setStorageError(''); }
    catch { setStorageError('Appearance changed for now, but could not be saved on this device. Allow browser storage, then choose it again.'); }
  }
  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, storageError }}>{children}</ThemeContext.Provider>;
}

export function useOwnerTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('OwnerThemeProvider missing');
  return value;
}
