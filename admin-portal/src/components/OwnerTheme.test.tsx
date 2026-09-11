import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OWNER_THEME_KEY, OwnerThemeProvider, useOwnerTheme } from './OwnerTheme';

function Controls() {
  const { theme, resolvedTheme, setTheme, storageError } = useOwnerTheme();
  return <><span>{theme}:{resolvedTheme}</span><button onClick={() => setTheme('light')}>Light</button><button onClick={() => setTheme('system')}>System</button>{storageError && <p role="alert">{storageError}</p>}</>;
}
describe('Owner Desk appearance', () => {
  let dark = true;
  let listeners: Set<() => void>;
  let values: Map<string, string>;
  let failWrite = false;
  beforeEach(() => {
    dark = true; failWrite = false; values = new Map(); listeners = new Set();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (failWrite) throw Error('blocked'); values.set(key, value); } });
    vi.stubGlobal('matchMedia', () => ({ get matches() { return dark; }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.documentElement.dataset.ownerTheme; });
  it('tracks device changes only while System is selected and removes its listener', () => {
    const view = render(<OwnerThemeProvider><Controls/></OwnerThemeProvider>);
    expect(document.documentElement.dataset.ownerTheme).toBe('dark');
    act(() => { dark = false; listeners.forEach(fn => fn()); });
    expect(document.documentElement.dataset.ownerTheme).toBe('light');
    fireEvent.click(screen.getByText('Light'));
    act(() => { dark = true; listeners.forEach(fn => fn()); });
    expect(document.documentElement.dataset.ownerTheme).toBe('light');
    fireEvent.click(screen.getByText('System'));
    expect(document.documentElement.dataset.ownerTheme).toBe('dark');
    view.unmount(); expect(listeners.size).toBe(0);
  });
  it('restores a saved choice across a remount', () => {
    const view = render(<OwnerThemeProvider><Controls/></OwnerThemeProvider>);
    fireEvent.click(screen.getByText('Light'));
    expect(values.get(OWNER_THEME_KEY)).toBe('light');
    view.unmount(); render(<OwnerThemeProvider><Controls/></OwnerThemeProvider>);
    expect(screen.getByText('light:light')).toBeInTheDocument();
  });
  it('keeps a temporary choice usable while clearly reporting failed persistence', () => {
    failWrite = true;
    render(<OwnerThemeProvider><Controls/></OwnerThemeProvider>);
    fireEvent.click(screen.getByText('Light'));
    expect(document.documentElement.dataset.ownerTheme).toBe('light');
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
    failWrite = false; fireEvent.click(screen.getByText('Light'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(values.get(OWNER_THEME_KEY)).toBe('light');
  });
});
