import { describe, expect, test } from 'vitest';
import { isMonthDay, parseMonthDay } from './celebrations';

describe('parseMonthDay', () => {
  test.each([
    ['07/24', { month: 7, day: 24 }],
    ['7/4', { month: 7, day: 4 }],
    ['12/30/1981', { month: 12, day: 30, year: 1981 }],
    ['8/4/11', { month: 8, day: 4 }],
    ['0913', { month: 9, day: 13 }],
    ['July 24th 1950', { month: 7, day: 24, year: 1950 }],
    ['April 1', { month: 4, day: 1 }],
    ['Aug 4', { month: 8, day: 4 }],
    ['Sept. 3, 1972', { month: 9, day: 3, year: 1972 }],
    ['1946-08-12', { month: 8, day: 12, year: 1946 }],
  ])('%s', (text, want) => expect(parseMonthDay(text)).toEqual(want));

  test.each(['Confidential', '[Skipped]', '', '13/01', '02/30', 'someday'])(
    'not a date: %s',
    (text) => expect(parseMonthDay(text)).toBeNull(),
  );

  test('leap day is a real birthday', () => expect(isMonthDay(2, 29)).toBe(true));
});
