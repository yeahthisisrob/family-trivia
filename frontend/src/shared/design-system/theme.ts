import { createTheme, type PaletteOptions } from '@mui/material/styles';
import './mui-augmentation';

import { colors } from './tokens/colors';
import { radii } from './tokens/radii';
import { night, type SchemeTokens, schemes } from './tokens/schemes';
import { shadows } from './tokens/shadows';
import { spacing } from './tokens/spacing';
import { typography } from './tokens/typography';

const palette = (t: SchemeTokens): PaletteOptions => ({
  primary: t.primary,
  secondary: t.secondary,
  success: { main: t.success },
  error: { main: t.error },
  text: t.text,
  background: t.background,
  divider: t.divider,
  night,
});

/**
 * One theme per color scheme. Swapping the whole theme (ColorModeProvider)
 * keeps every `theme.palette.*` read in components correct in both schemes,
 * including colors computed in JavaScript with alpha().
 */
export const makeTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: { mode, ...palette(schemes[mode]) },

    typography: {
      fontFamily: typography.fontFamily.primary,
      h1: typography.h1,
      h2: typography.h2,
      h3: typography.h3,
      subtitle1: typography.subtitle1,
      subtitle2: typography.subtitle2,
      body1: typography.body1,
      body2: typography.body2,
      caption: typography.caption,
    },

    spacing: spacing.unit,

    shape: {
      borderRadius: radii.lg,
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
            borderRadius: radii.lg,
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

/** The light theme, for code that needs a theme object outside the provider. */
export const theme = makeTheme('light');
