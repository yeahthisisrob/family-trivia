import {
  convertToEasternTime,
  getNextMidnightET,
  getSecondsElapsedTodayET,
  getSecondsUntilMidnightET,
} from '@family-trivia/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';


// Mock date - 2025-05-08 at 11:00 AM ET (15:00 UTC, during DST)
const mockDate = new Date('2025-05-08T15:00:00Z');

describe('Eastern Time Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('convertToEasternTime correctly converts UTC to ET during DST', () => {
    const etDate = convertToEasternTime(new Date());
    expect(etDate.getHours()).toBe(11); // 15:00 UTC = 11:00 ET in May
  });

  test('getNextMidnightET returns correct UTC ISO string for midnight ET', () => {
    const nextMidnightET = getNextMidnightET();
    expect(nextMidnightET).toBe('2025-05-09T04:00:00.000Z');
  });

  test('getSecondsElapsedTodayET calculates seconds since midnight ET', () => {
    // 11:00 AM ET = 11 hours = 39,600 seconds since midnight
    const expected = 11 * 60 * 60;
    expect(getSecondsElapsedTodayET()).toBeCloseTo(expected, -2);
  });

  test('getSecondsUntilMidnightET calculates seconds to next midnight ET', () => {
    // 11:00 AM ET to midnight = 13 hours = 46,800 seconds
    const expected = 13 * 60 * 60;
    expect(getSecondsUntilMidnightET()).toBeCloseTo(expected, -2);
  });
});
