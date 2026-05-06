export const typography = {
  fontFamily: {
    primary: '"Roboto", "Helvetica", "Arial", sans-serif',
    monospace: '"Roboto Mono", "Courier New", monospace',
  },

  h1: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },

  h2: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '-0.005em',
  },

  h3: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },

  subtitle1: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },

  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },

  body1: {
    fontSize: '0.9375rem',
    fontWeight: 400,
    lineHeight: 1.6,
  },

  body2: {
    fontSize: '0.8125rem',
    fontWeight: 400,
    lineHeight: 1.5,
  },

  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.4,
  },

  chip: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
} as const;
