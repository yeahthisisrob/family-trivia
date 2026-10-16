/**
 * A theme is data: brand colors, surfaces, text and type for each color
 * scheme. Everything visual is derived from these tokens: the MUI theme
 * (makeTheme) and the CSS variables behind `colors.*` (schemeVars). Adding a
 * theme is adding one file to themes/; nothing else changes.
 */

export type Mode = 'light' | 'dark';

/** The resolved colors for one theme in one mode. */
export interface SchemeTokens {
  primary: { main: string; light: string; dark: string };
  secondary: { main: string; light: string; dark: string };
  success: string;
  error: string;
  background: { default: string; paper: string; subtle: string };
  text: { primary: string; secondary: string; disabled: string };
  divider: string;
  borderStrong: string;
  /** The app bar: a solid color or a CSS gradient. */
  header: string;
  /** Text and icons on the app bar. */
  onHeader: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  /** One line for the picker. */
  description: string;
  schemes: Record<Mode, SchemeTokens>;
  fonts?: { body?: string; heading?: string };
  /** Multiplies every font size; above 1 for easier reading. */
  fontScale?: number;
  /** Corner radius in px for cards and dialogs. */
  radius?: number;
}
