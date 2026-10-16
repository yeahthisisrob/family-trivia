# 0011. Light and dark, one theme per scheme, and a night surface for graphs

- Status: Accepted
- Date: 2026-10-16

## Context
Production and Storybook used different themes, and there was no dark mode.
Components compute many colors in JavaScript (`theme.palette.*`, `alpha()`),
so MUI's CSS-variable color schemes would have left them showing light
values in dark mode.

## Decision
- One design system (`frontend/src/shared/design-system`). `makeTheme(mode)`
  builds a full theme per scheme from semantic tokens (`tokens/schemes.ts`);
  `ColorModeProvider` swaps the whole theme, so every `theme.palette.*` read
  is correct in both. It follows the device setting until someone picks one
  with the sun/moon toggle, and remembers the choice on that device.
- The **night surface** (`palette.night`) is where the family graph, maps
  and charts live. It is dark in both schemes on purpose: glowing people and
  colored lines read best on a deep sky, and the graph looks the same for
  everyone.
- Letters (season and memorial) keep warm paper in both schemes.
- `__tests__/contrast.test.ts` checks WCAG AA for the main pairings in both
  schemes and on the night surface. Storybook has a Light/Dark switch.

## Consequences
New components use palette keys or `theme.palette`, never raw hex, so they
work in both schemes. Game boards keep their own fixed colors.
