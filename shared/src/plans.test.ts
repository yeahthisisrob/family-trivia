import { describe, expect, test } from 'vitest';
import { cleanDrop, type Drop, daysOf, plansView } from './plans';

const drop = (over: Partial<Drop>): Drop => ({
  id: 'd',
  by: 'alice',
  kind: 'busy',
  title: 'Dentist',
  start: '2026-11-02',
  createdAt: 'now',
  ...over,
});

describe('plans', () => {
  test('a weekend spans its days; a weekly drop repeats on its weekday', () => {
    expect(
      daysOf(drop({ start: '2026-11-06', end: '2026-11-08' }), '2026-11-01', '2026-11-30'),
    ).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    expect(
      daysOf(
        drop({ start: '2026-11-03', weekly: { until: '2026-11-24' } }),
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  });

  test("someone else's busy time shows as Busy; plans and free days show in full", () => {
    const v = plansView(
      'bob',
      ['alice', 'bob', 'carol'],
      [
        drop({ id: 'a', title: 'Dentist', said: 'dentist monday' }),
        drop({ id: 'b', by: 'carol', kind: 'plan', title: 'Hike?', start: '2026-11-07' }),
        drop({ id: 'c', by: 'bob', kind: 'free', title: 'Free', start: '2026-11-07' }),
      ],
      {},
      '2026-11-01',
      '2026-11-14',
    );
    expect(v.drops.find((d) => d.id === 'a')).toMatchObject({ title: 'Busy', said: undefined });
    expect(v.drops.find((d) => d.id === 'b')?.title).toBe('Hike?');
    const sat = v.days.find((d) => d.date === '2026-11-07');
    expect(sat).toMatchObject({ busy: [], free: ['bob'], plans: ['b', 'c'] });
    expect(v.best[0]).toBe('2026-11-07');
    expect(v.days.find((d) => d.date === '2026-11-02')?.busy).toEqual(['alice']);
  });

  test('what the AI proposes is checked: bad dates and kinds are dropped, spans are capped', () => {
    const base = { id: 'x', by: 'alice', createdAt: 'now' };
    expect(cleanDrop({ kind: 'party', title: 'x', start: '2026-11-01' }, base)).toBeNull();
    expect(cleanDrop({ kind: 'busy', title: 'x', start: 'next week' }, base)).toBeNull();
    expect(
      cleanDrop({ kind: 'busy', title: 'Trip', start: '2026-11-01', end: '2027-11-01' }, base),
    ).not.toHaveProperty('end');
    expect(
      cleanDrop({ kind: 'busy', title: 'Choir', start: '2026-11-03', weekly: true }, base),
    ).toMatchObject({ weekly: { until: '2027-02-02' } });
  });

  test('a clock time and a place make a drop an event; the time replaces the part of day', () => {
    const base = { id: 'x', by: 'alice', createdAt: 'now', said: "Thursday 4:30 at Grandpa's" };
    const visit = cleanDrop(
      {
        kind: 'plan',
        title: 'Visit',
        start: '2026-11-05',
        part: 'afternoon',
        time: '16:30',
        place: "Grandpa's",
      },
      base,
    );
    expect(visit).toMatchObject({
      time: { start: '16:30' },
      zone: 'America/New_York',
      place: "Grandpa's",
    });
    expect(visit).not.toHaveProperty('part');
    expect(
      cleanDrop({ kind: 'plan', title: 'Visit', start: '2026-11-05', time: '4:30pm' }, base)?.time,
    ).toBeUndefined();
  });
});
