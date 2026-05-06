import { createTheme } from '@mui/material/styles';

import { colors } from './tokens/colors';
import { radii } from './tokens/radii';
import { shadows } from './tokens/shadows';
import { spacing } from './tokens/spacing';
import { typography } from './tokens/typography';

export const theme = createTheme({
  palette: {
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
    success: {
      main: colors.result.correct,
    },
    error: {
      main: colors.result.incorrect,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.disabled,
    },
    background: {
      default: colors.surface.default,
      paper: colors.surface.card,
    },
    divider: colors.border.light,
  },

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
        root: {
          boxShadow: shadows.card,
          borderRadius: radii.lg,
        },
      },
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
