import { getContrastRatio } from '@mui/material/styles';
import { describe, expect, test } from 'vitest';
import { night } from '../themes/night';
import { THEMES } from '../themes/registry';

// WCAG AA: 4.5:1 for body text, 3:1 for large text and UI parts. Many
// players are older or read on a phone in daylight; the bar isn't optional,
// and every theme in the registry must clear it in both modes.
const AA = 4.5;
const AA_LARGE = 3;
const solid = (c: string) =>
  c.startsWith('linear-gradient') ? (c.match(/#[0-9a-f]{6}/i)?.[0] ?? c) : c;

describe.each(
  THEMES.flatMap((t) =>
    (['light', 'dark'] as const).map((m) => [t.name, m, t.schemes[m]] as const),
  ),
)('%s, %s', (_name, _mode, s) => {
  test.each([
    ['primary text on the page', s.text.primary, s.background.default, AA],
    ['primary text on cards', s.text.primary, s.background.paper, AA],
    ['secondary text on cards', s.text.secondary, s.background.paper, AA],
    ['primary as text or icons on cards', s.primary.main, s.background.paper, AA_LARGE],
    ['secondary as text or icons on cards', s.secondary.main, s.background.paper, AA_LARGE],
    ['error on cards', s.error, s.background.paper, AA_LARGE],
    ['text on the app bar', s.onHeader, solid(s.header), AA],
  ])('%s', (_label, fg, bg, min) => {
    expect(getContrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

describe('night surface', () => {
  test('text reads on the sky', () => {
    expect(getContrastRatio(night.text, night.sky)).toBeGreaterThanOrEqual(AA);
    expect(getContrastRatio(night.textDim, night.sky)).toBeGreaterThanOrEqual(AA);
  });
});
