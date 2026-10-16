# 0012. Themes are data, and every color is a token

- Status: Accepted (extends 0011)
- Date: 2026-10-16

## Context
Light and dark alone was the wrong axis. A family app wants themes (a warm
heirloom look, high contrast for older eyes, a holiday or memorial season),
and the code held about 580 raw colors that couldn't follow any of it.

## Decision
- A theme is a `ThemeDefinition` in `frontend/src/shared/design-system/themes/`:
  brand, surfaces, text, header, fonts and shape for light and dark. Adding a
  theme is adding a file; nothing else changes. Built in: Classic, Garden,
  Ocean, Sunset, Heirloom, High contrast.
- Appearance has two independent choices: theme × mode (light, dark, auto).
  Theme resolves as: this person's pick (saved on their device), then the
  family default (an admin sets it; `config/appearance.json`), then Classic.
- `AppearanceProvider` builds the MUI theme for the active theme × mode and
  writes the CSS variables behind `colors.*` on :root, so palette reads and
  token strings both follow the theme.
- Every color in a component comes from the design system: a theme palette
  key (`'text.secondary'`), `theme.palette.*`, or a token (`colors.accent.*`,
  `colors.onColor`, `colors.scrim`, `games.*`, `paper.*`). Game boards and
  letters keep fixed art palettes in tokens, named by what they paint.
  Biome's `no-raw-colors` rule (biome-plugins/) flags raw hex and rgb() in
  components.
- Every theme × mode passes WCAG AA contrast (`__tests__/contrast.test.ts`)
  and the dark audit (`scripts/dark-audit.mjs`) runs in CI.

## Consequences
New themes and seasonal looks are cheap. A component that needs a new color
adds a named token instead of a literal. `alpha()` can't read CSS variables;
use `tint()` on tokens.
