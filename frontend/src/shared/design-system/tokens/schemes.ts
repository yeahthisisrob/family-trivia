/**
 * Semantic colors for light and dark. Components use these through the theme
 * (palette keys like `background.paper`, `text.secondary`), never raw hex, so
 * both schemes work everywhere. Brand green and warm orange stay the identity
 * in both; dark mode lifts them a step so they read on charcoal.
 */
import { colors } from './colors';

// Raw light values: the color tokens themselves are CSS variables now.
const LIGHT = {
  surfaceDefault: '#f9f9f9',
  surfaceCard: '#ffffff',
  surfaceSubtle: '#f5f5f5',
  textPrimary: 'rgba(0, 0, 0, 0.87)',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  textDisabled: 'rgba(0, 0, 0, 0.38)',
  border: 'rgba(0, 0, 0, 0.12)',
  borderMedium: 'rgba(0, 0, 0, 0.23)',
};

export interface SchemeTokens {
  primary: { main: string; light: string; dark: string };
  secondary: { main: string; light: string; dark: string };
  success: string;
  error: string;
  background: { default: string; paper: string };
  text: { primary: string; secondary: string; disabled: string };
  divider: string;
}

export const schemes: Record<'light' | 'dark', SchemeTokens> = {
  light: {
    primary: {
      main: colors.brand.primary,
      light: colors.brand.primaryLight,
      dark: colors.brand.primaryDark,
    },
    secondary: {
      main: colors.brand.secondary,
      light: colors.brand.secondaryLight,
      dark: colors.brand.secondaryDark,
    },
    success: '#2e7d32',
    error: '#c62828',
    background: { default: LIGHT.surfaceDefault, paper: LIGHT.surfaceCard },
    text: {
      primary: LIGHT.textPrimary,
      secondary: LIGHT.textSecondary,
      disabled: LIGHT.textDisabled,
    },
    divider: LIGHT.border,
  },
  dark: {
    primary: { main: '#66bb6a', light: '#98ee99', dark: '#338a3e' },
    secondary: { main: '#ffb74d', light: '#ffe97d', dark: '#c88719' },
    success: '#81c784',
    error: '#ef9a9a',
    background: { default: '#121417', paper: '#1b1e22' },
    text: {
      primary: 'rgba(255, 255, 255, 0.92)',
      secondary: 'rgba(255, 255, 255, 0.68)',
      disabled: 'rgba(255, 255, 255, 0.4)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
};

/**
 * The night surface: where the family graph, maps and charts live. It is dark
 * in both schemes on purpose: glowing people, colored lines and soft halos
 * read best on a deep sky, and the graph looks the same for everyone.
 */
export const night = {
  sky: '#0b1020',
  surface: '#121a2e',
  raised: '#1a2440',
  grid: 'rgba(230, 236, 255, 0.08)',
  line: 'rgba(230, 236, 255, 0.22)',
  text: '#e6ecff',
  textDim: 'rgba(230, 236, 255, 0.62)',
  glow: 'rgba(140, 170, 255, 0.35)',
} as const;

/** The CSS variables behind colors.surface / colors.text / colors.border, per scheme. */
export function schemeVars(mode: 'light' | 'dark'): Record<string, string> {
  const t = schemes[mode];
  return {
    '--ft-surface-default': t.background.default,
    '--ft-surface-card': t.background.paper,
    '--ft-surface-subtle': mode === 'dark' ? '#23272c' : LIGHT.surfaceSubtle,
    '--ft-text-primary': t.text.primary,
    '--ft-text-secondary': t.text.secondary,
    '--ft-text-disabled': t.text.disabled,
    '--ft-border-light': t.divider,
    '--ft-border-medium': mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : LIGHT.borderMedium,
  };
}
