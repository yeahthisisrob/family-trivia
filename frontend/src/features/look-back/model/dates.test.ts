import { describe, expect, test } from 'vitest';
import { seasonDates } from './dates';

describe('seasonDates', () => {
  test('a season that ended', () =>
    expect(
      seasonDates({ number: 1, name: 'S', startDate: '2025-06-01', endDate: '2025-07-31' }),
    ).toBe('June 2025 to July 2025'));
  test('a season still running says since when', () =>
    expect(seasonDates({ number: 1, name: 'S', startDate: '2025-06-01', endDate: null })).toBe(
      'Since June 2025',
    ));
});
