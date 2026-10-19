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
