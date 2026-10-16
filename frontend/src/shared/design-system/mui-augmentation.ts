import type { night } from './themes/night';

// The night surface is part of the palette so components read it from the
// theme like any other color: `theme.palette.night.sky`.
declare module '@mui/material/styles' {
  interface Palette {
    night: typeof night;
  }
  interface PaletteOptions {
    night?: typeof night;
  }
}
