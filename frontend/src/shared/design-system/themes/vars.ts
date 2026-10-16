import type { SchemeTokens } from './types';

/**
 * The CSS variables behind `colors.*` (tokens/colors.ts) for one theme and
 * mode. AppearanceProvider writes them on :root, so any component using a
 * color token follows the active theme without reading the MUI theme.
 */
export function schemeVars(t: SchemeTokens): Record<string, string> {
  return {
    '--ft-brand-primary': t.primary.main,
    '--ft-brand-primary-light': t.primary.light,
    '--ft-brand-primary-dark': t.primary.dark,
    '--ft-brand-secondary': t.secondary.main,
    '--ft-brand-secondary-light': t.secondary.light,
    '--ft-brand-secondary-dark': t.secondary.dark,
    '--ft-surface-default': t.background.default,
    '--ft-surface-card': t.background.paper,
    '--ft-surface-subtle': t.background.subtle,
    '--ft-surface-header': t.header,
    '--ft-on-header': t.onHeader,
    '--ft-text-primary': t.text.primary,
    '--ft-text-secondary': t.text.secondary,
    '--ft-text-disabled': t.text.disabled,
    '--ft-border-light': t.divider,
    '--ft-border-medium': t.borderStrong,
  };
}
