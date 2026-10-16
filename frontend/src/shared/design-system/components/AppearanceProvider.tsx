/**
 * Appearance: which theme, and light or dark. Two independent choices.
 *
 * Theme, most specific first: this person's pick on this device, then the
 * family's default (set by an admin), then Classic. Mode: light, dark, or
 * following the device. Provides the matching MUI theme and the CSS
 * variables behind `colors.*` to everything below it.
 */
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { makeTheme } from '../theme';
import { DEFAULT_THEME_ID, THEMES, themeById } from '../themes/registry';
import type { Mode, ThemeDefinition } from '../themes/types';
import { schemeVars } from '../themes/vars';

export type ColorMode = Mode | 'system';

interface Saved {
  themeId?: string;
  mode?: ColorMode;
}

interface AppearanceValue {
  /** The theme showing now. */
  theme: ThemeDefinition;
  /** This person's own pick, if they made one. */
  chosenThemeId: string | null;
  familyThemeId: string | null;
  mode: ColorMode;
  resolved: Mode;
  themes: readonly ThemeDefinition[];
  setTheme: (id: string | null) => void;
  setMode: (mode: ColorMode) => void;
  /** Called once the family's settings load. */
  setFamilyTheme: (id: string | null) => void;
}

const STORAGE_KEY = 'ft:appearance';
const Ctx = createContext<AppearanceValue | null>(null);

const read = (): Saved => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
};
const write = (s: Saved) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode: the choice lasts this visit */
  }
};
const prefersDark = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** `initial` starts from given choices without reading the device (Storybook, tests). */
export const AppearanceProvider: React.FC<{ children: React.ReactNode; initial?: Saved }> = ({
  children,
  initial,
}) => {
  const [saved, setSaved] = useState<Saved>(() => initial ?? read());
  const [familyThemeId, setFamilyThemeId] = useState<string | null>(null);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const update = useCallback(
    (patch: Saved) =>
      setSaved((s) => {
        const next = { ...s, ...patch };
        if (!initial) write(next);
        return next;
      }),
    [initial],
  );

  const mode = saved.mode ?? 'system';
  const resolved: Mode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const theme = themeById(saved.themeId ?? familyThemeId ?? DEFAULT_THEME_ID);
  const muiTheme = useMemo(() => makeTheme(theme.id, resolved), [theme.id, resolved]);

  const value = useMemo<AppearanceValue>(
    () => ({
      theme,
      chosenThemeId: saved.themeId ?? null,
      familyThemeId,
      mode,
      resolved,
      themes: THEMES,
      setTheme: (id) => update({ themeId: id ?? undefined }),
      setMode: (m) => update({ mode: m }),
      setFamilyTheme: setFamilyThemeId,
    }),
    [theme, saved.themeId, familyThemeId, mode, resolved, update],
  );

  return (
    <Ctx.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <GlobalStyles
          styles={{ ':root': { ...schemeVars(theme.schemes[resolved]), colorScheme: resolved } }}
        />
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  );
};

const fallback: AppearanceValue = {
  theme: themeById(DEFAULT_THEME_ID),
  chosenThemeId: null,
  familyThemeId: null,
  mode: 'light',
  resolved: 'light',
  themes: THEMES,
  setTheme: () => undefined,
  setMode: () => undefined,
  setFamilyTheme: () => undefined,
};

/** Outside a provider (a lone story), Classic light with no-op setters. */
export const useAppearance = (): AppearanceValue => useContext(Ctx) ?? fallback;
