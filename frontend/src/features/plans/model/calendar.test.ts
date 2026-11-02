import { type Drop, plansView } from '@family-trivia/shared';
import { describe, expect, test } from 'vitest';
import { daysIn, eventsByDay, monthWindow, shiftMonth } from './calendar';

describe('the month grid', () => {
  test('whole weeks, Monday first', () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    expect(monthWindow('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(daysIn('2026-10-26', '2026-12-06')).toHaveLength(42);
  });

  test('months move across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  test('a weekly event is on every day it happens, by time; busy time is not', () => {
    const drop = (d: Partial<Drop>): Drop => ({
      id: 'x',
      by: 'alice',
      kind: 'plan',
      title: 't',
      start: '2026-11-03',
      createdAt: 'n',
      ...d,
    });
    const view = plansView(
      'alice',
      ['alice', 'bob'],
      [
        drop({ id: 'gym', time: { start: '17:30' }, weekly: { days: ['TU', 'TH'] } }),
        drop({ id: 'lunch', time: { start: '12:00' }, start: '2026-11-05' }),
        drop({ id: 'away', kind: 'busy', start: '2026-11-05' }),
      ],
      {},
      '2026-11-01',
      '2026-11-14',
    );
    const days = eventsByDay(view);
    expect(days.get('2026-11-05')?.map((d) => d.id)).toEqual(['lunch', 'gym']);
    expect([...days.keys()]).toEqual(['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12']);
  });
});
