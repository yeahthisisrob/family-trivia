import { describe, it, expect } from 'vitest';

import { isCustomCategory } from './categoryUtils';

describe('isCustomCategory', () => {
  it('returns false for empty string', () => {
    expect(isCustomCategory('')).toBe(false);
  });

  it('returns true for the literal "Custom"', () => {
    expect(isCustomCategory('Custom')).toBe(true);
  });

  it('recognizes all known system categories', () => {
    const systemCategories = [
      'History & Politics',
      'Science & Nature',
      'Geography & Travel',
      'Pop Culture',
      'Sports & Games',
      'Literature & Arts',
      'Fun Facts & Oddities',
    ];
    for (const name of systemCategories) {
      expect(isCustomCategory(name)).toBe(false);
    }
  });

  it('treats long names (>20 chars) as custom', () => {
    expect(isCustomCategory('My Really Long Custom Category Name')).toBe(true);
  });

  it('treats names with colons as custom', () => {
    expect(isCustomCategory('Custom: Space Exploration')).toBe(true);
  });

  it('returns true for medical-adjacent keywords', () => {
    expect(isCustomCategory('Medical Trivia')).toBe(true);
    expect(isCustomCategory('Neonatology')).toBe(true);
    expect(isCustomCategory('Health & Wellness')).toBe(true);
  });

  it('returns true for trivia/wonders keywords', () => {
    expect(isCustomCategory('Movie Trivia')).toBe(true);
    expect(isCustomCategory('World Wonders')).toBe(true);
  });

  it('returns false for short unknown names without keywords', () => {
    // Short name (<= 20), no colon, no known keywords, not in cache
    expect(isCustomCategory('Random')).toBe(false);
  });
});
