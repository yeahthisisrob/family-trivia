# Design system

Why: docs/decisions/0011 and 0012.

## Where colors come from (in order of preference)

1. **A theme role**, as an sx palette key or from `theme.palette`:
   `'primary.main'`, `'secondary.main'`, `'text.secondary'`,
   `'background.paper'`, `'divider'`, `'success.main'`, `'error.main'`,
   `'action.hover'`. Follows theme and mode.
2. **A token** from `colors` (`tokens/colors.ts`):
   - `colors.onColor`: text and icons on a colored surface (was `'#fff'`).
   - `colors.scrim`: shadows and dark overlays, always via `alpha(colors.scrim, x)` (was `'#000'`).
   - `colors.accent.*`: fixed decorative hues that name a thing (a category, a badge).
   - `colors.medal.*`, `colors.difficulty.*`, `colors.result.*`, `colors.gameMode.*`.
   - `colors.surface.*`, `colors.text.*`, `colors.border.*`, `colors.brand.*`: CSS
     variables that follow the theme. Fade them with `tint(color, 0.5)`, not `alpha()`.
   - `identityColor(userId)`: a person's color.
3. **Art palettes** for things that are drawings, not chrome:
   `games.<game>.<thing>` (`tokens/games.ts`) and `paper.*` (letters).

Never a raw `'#…'` or `'rgb(…)'` in a component: the `no-raw-colors` lint rule
flags it. If nothing fits, add a named token.

## Checks
- `__tests__/contrast.test.ts`: WCAG AA for every theme × mode.
- `just dark-audit`: every story in dark mode, no large light backgrounds.
