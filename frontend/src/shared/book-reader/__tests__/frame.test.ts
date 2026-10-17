import { describe, expect, it } from 'vitest';
import { pageFileName, SOCIAL, socialFrame } from '../frame';

describe('socialFrame', () => {
  it('fits a 6 × 9 page whole inside a 4:5 image, centred, with room around it', () => {
    const f = socialFrame(432, 648);
    expect([f.width, f.height]).toEqual([SOCIAL.width, SOCIAL.height]);
    expect(f.page.height).toBeLessThan(SOCIAL.height);
    expect(f.page.y).toBeGreaterThan(0);
    expect(Math.abs(f.page.x * 2 + f.page.width - SOCIAL.width)).toBeLessThanOrEqual(1);
    expect(f.page.width / f.page.height).toBeCloseTo(432 / 648, 2);
  });
});

describe('pageFileName', () => {
  it('names pages so they sort in reading order', () => {
    expect(pageFileName('Alice, in her own words', 3, 18)).toBe('alice-in-her-own-words-03.png');
    expect(pageFileName('!!!', 1, 5)).toBe('book-1.png');
  });
});
