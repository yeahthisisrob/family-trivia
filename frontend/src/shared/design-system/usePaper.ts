import { useTheme } from '@mui/material';
import { paper, paperNight } from './tokens';

export type Paper = { [K in keyof typeof paper]: string };

/**
 * The paper for the screen: cream with ink in light mode, warm brown with
 * cream ink in dark. Printed books always use `paper`.
 */
export function usePaper(): Paper & { light: boolean } {
  const light = useTheme().palette.mode !== 'dark';
  return { ...(light ? paper : paperNight), light };
}

const mix = (color: string, percent: number, base: string) =>
  `color-mix(in srgb, ${color} ${percent}%, ${base})`;

/**
 * Paper in the circle's own colors, for letters from the circle (a season
 * opening or ending): the theme's surface warmed with its brand color, its
 * text for ink. Memorial pages keep the plain paper above.
 */
export function useLetterPaper(): Paper & { light: boolean } {
  const { palette } = useTheme();
  const light = palette.mode !== 'dark';
  const surface = palette.background.paper;
  return {
    paper: mix(palette.primary.main, light ? 5 : 8, surface),
    edge: mix(palette.secondary.main, light ? 14 : 18, surface),
    glow: mix(palette.primary.light, light ? 18 : 14, surface),
    ink: palette.text.primary,
    inkSoft: palette.text.secondary,
    rule: mix(palette.primary.main, 45, surface),
    shadow: (light ? paper : paperNight).shadow,
    serif: paper.serif,
    light,
  };
}
