import { describe, expect, test } from 'vitest';
import { categoriesFor, DEFAULT_CATEGORIES, isFamilyCategory } from './categories';
import { startersFor } from './starters';

describe('categories per circle', () => {
  test("the circle's own category takes its kind's name, and still counts as itself", () => {
    expect(categoriesFor([], 'family', 'friends').map((c) => c.name)).toEqual(['Our Crew']);
    expect(categoriesFor([], 'mixed', 'mixed')[0]?.name).toBe('About Us');
    expect(categoriesFor([], 'mixed')[0]?.name).toBe('Our Family');
    expect(categoriesFor([], 'general', 'friends')).toEqual(DEFAULT_CATEGORIES);
    for (const n of ['Our Family', 'Our Crew', 'About Us']) expect(isFamilyCategory(n)).toBe(true);
    expect(isFamilyCategory('Pop Culture')).toBe(false);
  });

  test('every kind starts with a birthday and a few easy questions', () => {
    for (const k of ['family', 'friends', 'mixed'] as const) {
      expect(startersFor(k)[0]).toMatch(/birthday/);
      expect(startersFor(k).length).toBeLessThanOrEqual(5);
    }
    expect(startersFor('friends').join(' ')).not.toMatch(/family/i);
  });
});

describe('pace', () => {
  test('a weekly season counts weeks from Monday; a daily one counts days', async () => {
    const { periodsBetween, playPeriod, perPeriod } = await import('./season');
    expect(playPeriod('2026-10-22', 'weekly')).toBe('2026-10-19'); // a Thursday → its Monday
    expect(playPeriod('2026-10-19', 'weekly')).toBe('2026-10-19');
    expect(playPeriod('2026-10-25', 'weekly')).toBe('2026-10-19'); // Sunday ends the week
    expect(playPeriod('2026-10-22', 'daily')).toBe('2026-10-22');
    expect(periodsBetween('2026-10-01', '2026-10-22', 'weekly')).toBe(3);
    expect(periodsBetween('2026-10-20', '2026-10-22', 'daily')).toBe(2);
    expect(perPeriod({ pace: 'weekly' })).toBe(5);
    expect(perPeriod({ pace: 'weekly', perWeek: 3 })).toBe(3);
    expect(perPeriod({})).toBe(1);
  });
});
