export const spacing = {
  /** Base MUI spacing unit in px */
  unit: 8,

  /** Named spacing values in px */
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,

  /** Minimum touch target size in px (WCAG / Material guidelines) */
  touchTarget: 48,

  /** Card internal padding by breakpoint */
  cardPadding: {
    xs: 12,
    sm: 16,
  },

  /** Vertical gap between page sections by breakpoint */
  sectionGap: {
    xs: 16,
    sm: 24,
  },

  /** Gap between chips / tags */
  chipGap: 4,
} as const;
