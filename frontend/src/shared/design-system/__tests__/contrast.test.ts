import { getContrastRatio } from '@mui/material/styles';
import { describe, expect, test } from 'vitest';
import { night, schemes } from '../tokens/schemes';

// WCAG AA: 4.5:1 for body text, 3:1 for large text and UI parts. Many
// players are older or read on a phone in daylight; the bar isn't optional.
const AA = 4.5;
const AA_LARGE = 3;

describe.each(['light', 'dark'] as const)('%s scheme', (mode) => {
  const s = schemes[mode];
  test.each([
    ['primary text on page', s.text.primary, s.background.default, AA],
    ['primary text on cards', s.text.primary, s.background.paper, AA],
    ['secondary text on cards', s.text.secondary, s.background.paper, AA],
    ['brand green as text on cards', s.primary.main, s.background.paper, AA_LARGE],
    ['error as text on cards', s.error, s.background.paper, AA_LARGE],
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
