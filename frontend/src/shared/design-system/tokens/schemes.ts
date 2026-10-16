/**
 * Semantic colors for light and dark. Components use these through the theme
 * (palette keys like `background.paper`, `text.secondary`), never raw hex, so
 * both schemes work everywhere. Brand green and warm orange stay the identity
 * in both; dark mode lifts them a step so they read on charcoal.
 */
import { colors } from './colors';

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
    background: { default: colors.surface.default, paper: colors.surface.card },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.disabled,
    },
    divider: colors.border.light,
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
