/**
 * Light and dark. Follows the device setting until someone chooses, then
 * remembers the choice on this device. Provides the matching theme to
 * everything below it.
 */
import { CssBaseline, ThemeProvider } from '@mui/material';
import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { makeTheme } from '../theme';

export type ColorMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'ft:colorMode';

interface ColorModeValue {
  mode: ColorMode;
  /** What's showing right now. */
  resolved: 'light' | 'dark';
  setMode: (mode: ColorMode) => void;
}

const Ctx = createContext<ColorModeValue | null>(null);

const readStored = (): ColorMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const themes = { light: makeTheme('light'), dark: makeTheme('dark') };

/** `initialMode` starts in a given mode without reading the saved choice (Storybook, tests). */
export const ColorModeProvider: React.FC<{
  children: React.ReactNode;
  initialMode?: ColorMode;
}> = ({ children, initialMode }) => {
  const [mode, setModeState] = useState<ColorMode>(() => initialMode ?? readStored());
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  const value = useMemo<ColorModeValue>(
    () => ({
      mode,
      resolved,
      setMode: (m) => {
        setModeState(m);
        try {
          if (m === 'system') localStorage.removeItem(STORAGE_KEY);
          else localStorage.setItem(STORAGE_KEY, m);
        } catch {
          /* private mode: the choice lasts this visit */
        }
      },
    }),
    [mode, resolved],
  );

  return (
    <Ctx.Provider value={value}>
      <ThemeProvider theme={themes[resolved]}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  );
};

/** Outside a provider (a lone story), behaves as light with a no-op setter. */
export const useColorMode = (): ColorModeValue =>
  useContext(Ctx) ?? { mode: 'light', resolved: 'light', setMode: () => undefined };
