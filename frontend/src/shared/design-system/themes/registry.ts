/**
 * The built-in themes. Each one is checked for WCAG AA contrast in both
 * schemes (__tests__/contrast.test.ts), so a new theme can't ship unreadable.
 *
 * Neutrals shared by most themes live in `light` / `dark` below; a theme
 * overrides what makes it itself.
 */
import type { Mode, SchemeTokens, ThemeDefinition } from './types';

const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

const light = (
  over: Partial<SchemeTokens> & Pick<SchemeTokens, 'primary' | 'secondary'>,
): SchemeTokens => ({
  success: '#2e7d32',
  error: '#c62828',
  background: { default: '#f9f9f9', paper: '#ffffff', subtle: '#f5f5f5' },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.62)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  divider: 'rgba(0, 0, 0, 0.12)',
  borderStrong: 'rgba(0, 0, 0, 0.23)',
  header: over.primary.dark,
  onHeader: '#ffffff',
  ...over,
});

const dark = (
  over: Partial<SchemeTokens> & Pick<SchemeTokens, 'primary' | 'secondary'>,
): SchemeTokens => ({
  success: '#81c784',
  error: '#ef9a9a',
  background: { default: '#121417', paper: '#1b1e22', subtle: '#23272c' },
  text: {
    primary: 'rgba(255, 255, 255, 0.92)',
    secondary: 'rgba(255, 255, 255, 0.68)',
    disabled: 'rgba(255, 255, 255, 0.4)',
  },
  divider: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.23)',
  header: '#1b1e22',
  onHeader: 'rgba(255, 255, 255, 0.92)',
  ...over,
});

export const classic: ThemeDefinition = {
  id: 'classic',
  name: 'Classic',
  description: 'Green and orange, the original.',
  schemes: {
    light: light({
      primary: { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20' },
      secondary: { main: '#ef6c00', light: '#ffb74d', dark: '#e65100' },
    }),
    dark: dark({
      primary: { main: '#66bb6a', light: '#98ee99', dark: '#338a3e' },
      secondary: { main: '#ffb74d', light: '#ffe97d', dark: '#c88719' },
      header: '#16301a',
    }),
  },
};

export const garden: ThemeDefinition = {
  id: 'garden',
  name: 'Garden',
  description: 'Sage and terracotta on warm paper.',
  schemes: {
    light: light({
      primary: { main: '#4f7a4e', light: '#7da67b', dark: '#36573a' },
      secondary: { main: '#b5552f', light: '#e08a64', dark: '#8c3d1f' },
      background: { default: '#f6f2ea', paper: '#fffdf8', subtle: '#efe9dd' },
      text: {
        primary: '#2b2a26',
        secondary: 'rgba(43, 42, 38, 0.68)',
        disabled: 'rgba(43, 42, 38, 0.4)',
      },
      divider: 'rgba(43, 42, 38, 0.12)',
    }),
    dark: dark({
      primary: { main: '#93bf8f', light: '#c2e3be', dark: '#5f8a5c' },
      secondary: { main: '#e8946d', light: '#ffc3a0', dark: '#b2643f' },
      background: { default: '#16181a', paper: '#1e2124', subtle: '#262a2e' },
      header: '#1f2a1f',
    }),
  },
  radius: 10,
};

export const ocean: ThemeDefinition = {
  id: 'ocean',
  name: 'Ocean',
  description: 'Deep teal and coral.',
  schemes: {
    light: light({
      primary: { main: '#00695c', light: '#4db6ac', dark: '#004d40' },
      secondary: { main: '#d84315', light: '#ff8a65', dark: '#bf360c' },
      background: { default: '#f2f8f8', paper: '#ffffff', subtle: '#e7f1f1' },
    }),
    dark: dark({
      primary: { main: '#4db6ac', light: '#82e9de', dark: '#00867d' },
      secondary: { main: '#ff8a65', light: '#ffbb93', dark: '#c75b39' },
      background: { default: '#0f1517', paper: '#172024', subtle: '#1e2a2f' },
      header: '#0f2a2a',
    }),
  },
};

export const sunset: ThemeDefinition = {
  id: 'sunset',
  name: 'Sunset',
  description: 'Plum and amber, evening light.',
  schemes: {
    light: light({
      primary: { main: '#6a2c7a', light: '#9a59a9', dark: '#4a1a57' },
      secondary: { main: '#b26a00', light: '#f2a541', dark: '#8a5200' },
      background: { default: '#faf6f8', paper: '#ffffff', subtle: '#f3ecf1' },
      header: 'linear-gradient(120deg, #4a1a57 0%, #8e3b6f 60%, #b26a00 100%)',
    }),
    dark: dark({
      primary: { main: '#ce93d8', light: '#ffc4ff', dark: '#9c64a6' },
      secondary: { main: '#f2a541', light: '#ffd671', dark: '#bb7609' },
      background: { default: '#151217', paper: '#1e1a21', subtle: '#28222c' },
      header: 'linear-gradient(120deg, #2a1530 0%, #3d1d36 100%)',
    }),
  },
};

export const heirloom: ThemeDefinition = {
  id: 'heirloom',
  name: 'Heirloom',
  description: 'Ink, gold and paper, with serif type. Quiet and warm.',
  schemes: {
    light: light({
      primary: { main: '#5d4037', light: '#8b6b61', dark: '#3e2723' },
      secondary: { main: '#8d6e00', light: '#c9a227', dark: '#6b5300' },
      background: { default: '#f3ead7', paper: '#fbf6ea', subtle: '#ece1c9' },
      text: {
        primary: '#3a2e21',
        secondary: 'rgba(58, 46, 33, 0.72)',
        disabled: 'rgba(58, 46, 33, 0.42)',
      },
      divider: 'rgba(58, 46, 33, 0.16)',
      header: '#3e2723',
    }),
    dark: dark({
      primary: { main: '#d7b98e', light: '#ffebbf', dark: '#a58960' },
      secondary: { main: '#e0c070', light: '#fff3a0', dark: '#ab9042' },
      background: { default: '#17140f', paper: '#211c15', subtle: '#2a241b' },
      text: {
        primary: 'rgba(250, 240, 220, 0.92)',
        secondary: 'rgba(250, 240, 220, 0.68)',
        disabled: 'rgba(250, 240, 220, 0.4)',
      },
      header: '#211c15',
    }),
  },
  fonts: { heading: SERIF },
  radius: 6,
};

export const highContrast: ThemeDefinition = {
  id: 'high-contrast',
  name: 'High contrast',
  description: 'Strong contrast and larger text, for easier reading.',
  schemes: {
    light: light({
      primary: { main: '#0b3d91', light: '#3a63b8', dark: '#062a66' },
      secondary: { main: '#8a1c00', light: '#b84a2a', dark: '#5c1300' },
      error: '#9b0000',
      success: '#0b5d1e',
      background: { default: '#ffffff', paper: '#ffffff', subtle: '#f0f0f0' },
      text: { primary: '#000000', secondary: '#2b2b2b', disabled: '#5c5c5c' },
      divider: 'rgba(0, 0, 0, 0.4)',
      borderStrong: '#000000',
      header: '#000000',
    }),
    dark: dark({
      primary: { main: '#9cc3ff', light: '#cfe2ff', dark: '#6a93d1' },
      secondary: { main: '#ffb59a', light: '#ffd9cb', dark: '#c9846b' },
      background: { default: '#000000', paper: '#0d0d0d', subtle: '#1a1a1a' },
      text: { primary: '#ffffff', secondary: '#e0e0e0', disabled: '#a6a6a6' },
      divider: 'rgba(255, 255, 255, 0.45)',
      borderStrong: '#ffffff',
      header: '#000000',
      onHeader: '#ffffff',
    }),
  },
  fontScale: 1.12,
};

export const THEMES: readonly ThemeDefinition[] = [
  classic,
  garden,
  ocean,
  sunset,
  heirloom,
  highContrast,
];
/**
 * What a circle sees until its admin picks a theme. Classic, the original
 * green, stays a choice; a circle that wants it keeps it by choosing it.
 */
export const DEFAULT_THEME_ID = sunset.id;

export const themeById = (id: string | null | undefined): ThemeDefinition =>
  THEMES.find((t) => t.id === id) ?? sunset;

export const tokensFor = (id: string | null | undefined, mode: Mode): SchemeTokens =>
  themeById(id).schemes[mode];
