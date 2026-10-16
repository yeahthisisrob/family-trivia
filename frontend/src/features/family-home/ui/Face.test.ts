import { describe, expect, test } from 'vitest';
import { initials } from './Face';

describe('initials', () => {
  test.each([
    ['Bob', 'B'],
    ['Grandma Grace', 'G'],
    ['Aunt Ivy', 'I'],
    ['Uncle Sam Smith', 'SS'],
    ['Mary Jo Smith', 'MS'],
    ['Nana', 'N'],
    ['  carol  ', 'C'],
  ])('%s → %s', (name, want) => expect(initials(name)).toBe(want));
});
