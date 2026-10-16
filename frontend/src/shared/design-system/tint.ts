/**
 * Fade any color, CSS variables included: `tint(colors.surface.card, 0.92)`.
 * Uses color-mix, so it works where MUI's alpha() can't parse var(--…).
 */
export const tint = (color: string, opacity: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
