import { createTheme, type PaletteOptions } from '@mui/material/styles';
import './mui-augmentation';

import { night } from './themes/night';
import { DEFAULT_THEME_ID, themeById } from './themes/registry';
import type { Mode, SchemeTokens } from './themes/types';
import { radii } from './tokens/radii';
import { shadows } from './tokens/shadows';
import { spacing } from './tokens/spacing';
import { typography } from './tokens/typography';

const palette = (t: SchemeTokens): PaletteOptions => ({
  primary: t.primary,
  secondary: t.secondary,
  success: { main: t.success },
  error: { main: t.error },
  text: t.text,
  background: { default: t.background.default, paper: t.background.paper },
  divider: t.divider,
  night,
});

/**
 * The MUI theme for one theme definition in one mode. AppearanceProvider swaps
 * the whole object, so every `theme.palette.*` read in components is right
 * for the active theme and mode, including colors computed with alpha().
 */
export const makeTheme = (themeId: string, mode: Mode) => {
  const def = themeById(themeId);
  const t = def.schemes[mode];
  const scale = def.fontScale ?? 1;
  const rem = (v: string) => (scale === 1 ? v : `${(parseFloat(v) * scale).toFixed(4)}rem`);
  const heading = def.fonts?.heading;
  const step = <T extends { fontSize: string }>(v: T, isHeading = false) => ({
    ...v,
    fontSize: rem(v.fontSize),
    ...(isHeading && heading ? { fontFamily: heading, fontWeight: 500 } : {}),
  });
  const radius = def.radius ?? radii.lg;

  return createTheme({
    palette: { mode, ...palette(t) },

    typography: {
      fontFamily: def.fonts?.body ?? typography.fontFamily.primary,
      htmlFontSize: 16,
      h1: step(typography.h1, true),
      h2: step(typography.h2, true),
      h3: step(typography.h3, true),
      subtitle1: step(typography.subtitle1),
      subtitle2: step(typography.subtitle2),
      body1: step(typography.body1),
      body2: step(typography.body2),
      caption: step(typography.caption),
    },

    spacing: spacing.unit,

    shape: {
      borderRadius: radius,
    },

    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: spacing.touchTarget,
            textTransform: 'none' as const,
            borderRadius: radii.md,
            fontWeight: 600,
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            minWidth: spacing.touchTarget,
            minHeight: spacing.touchTarget,
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: spacing.touchTarget,
            textTransform: 'none' as const,
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            boxShadow: shadows.card,
            borderRadius: radius,
            // Shadows vanish on charcoal; a hairline keeps cards distinct.
            ...(t.palette.mode === 'dark' && {
              boxShadow: 'none',
              border: `1px solid ${t.palette.divider}`,
            }),
          }),
        },
      },
      MuiPaper: {
        // MUI lightens dark paper with a white overlay per elevation; the
        // schemes already pick the surface colors.
        styleOverrides: { root: { backgroundImage: 'none' } },
      },

      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: spacing.cardPadding.sm,
            '&:last-child': {
              paddingBottom: spacing.cardPadding.sm,
            },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            fontSize: typography.chip.fontSize,
            fontWeight: typography.chip.fontWeight,
            borderRadius: radii.full,
          },
        },
      },
    },
  });
};

/** Classic light, for code that needs a theme object outside the provider. */
export const theme = makeTheme(DEFAULT_THEME_ID, 'light');
