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
  /** Before circles: one pick for every circle. Read once as this circle's. */
  themeId?: string;
  mode?: ColorMode;
  /** Each circle's look on this device: the person's own pick, and the circle's theme (so a switch doesn't flash another). */
  circles?: Record<string, { themeId?: string; circleThemeId?: string }>;
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

/**
 * `initial` starts from given choices without reading the device (Storybook, tests).
 * `circleId` is the circle showing: a theme someone picks is theirs in that circle only.
 */
export const AppearanceProvider: React.FC<{
  children: React.ReactNode;
  initial?: Saved;
  circleId?: string | null;
}> = ({ children, initial, circleId }) => {
  const here = circleId ?? '';
  const [saved, setSaved] = useState<Saved>(() => initial ?? read());
  const mine = saved.circles?.[here];
  const [familyThemeId, setFamilyThemeId] = useState<string | null>(
    () => mine?.circleThemeId ?? null,
  );
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
  const updateHere = useCallback(
    (patch: { themeId?: string; circleThemeId?: string }) =>
      setSaved((s) => {
        const before = s.circles?.[here] ?? (s.themeId ? { themeId: s.themeId } : {});
        const next: Saved = {
          ...s,
          themeId: undefined,
          circles: { ...s.circles, [here]: { ...before, ...patch } },
        };
        if (!initial) write(next);
        return next;
      }),
    [initial, here],
  );
  const setFamilyTheme = useCallback(
    (id: string | null) => {
      setFamilyThemeId(id);
      if (id !== (saved.circles?.[here]?.circleThemeId ?? null))
        updateHere({ circleThemeId: id ?? undefined });
    },
    [saved.circles, here, updateHere],
  );

  const mode = saved.mode ?? 'system';
  const resolved: Mode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  // A pick from before circles counts for whichever circle opens first, then lives there.
  const chosen = mine ? mine.themeId : saved.themeId;
  const theme = themeById(chosen ?? familyThemeId ?? DEFAULT_THEME_ID);
  const muiTheme = useMemo(() => makeTheme(theme.id, resolved), [theme.id, resolved]);

  const value = useMemo<AppearanceValue>(
    () => ({
      theme,
      chosenThemeId: chosen ?? null,
      familyThemeId,
      mode,
      resolved,
      themes: THEMES,
      setTheme: (id) => updateHere({ themeId: id ?? undefined }),
      setMode: (m) => update({ mode: m }),
      setFamilyTheme,
    }),
    [theme, chosen, familyThemeId, mode, resolved, update, updateHere, setFamilyTheme],
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
