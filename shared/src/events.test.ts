import { describe, expect, test } from 'vitest';
import { cleanEvent, eventIcs, icsFileName, zonedToUtc } from './events';
import { canSee, type Drop, daysOf, finalDayOf, plansView } from './plans';

const base = { id: 'alice-e1', by: 'alice', createdAt: '2026-11-01T12:00:00.000Z' };
const event = (over: Record<string, unknown>): Drop => {
  const r = cleanEvent({ title: 'Gymnastics', start: '2026-11-03', ...over }, base);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('a weekly rule', () => {
  test('on given days, every other week, until a day', () => {
    const d = event({ weekly: { days: ['TU', 'TH'], until: '2026-11-19' } });
    expect(daysOf(d, '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-03',
      '2026-11-05',
      '2026-11-10',
      '2026-11-12',
      '2026-11-17',
      '2026-11-19',
    ]);
    const fortnight = event({ weekly: { every: 2 } });
    expect(daysOf(fortnight, '2026-11-01', '2026-11-30')).toEqual(['2026-11-03', '2026-11-17']);
  });

  test('a count counts skipped days too, as RRULE does with EXDATE', () => {
    const d = event({ weekly: { count: 3 }, skip: ['2026-11-10'] });
    expect(daysOf(d, '2026-11-01', '2026-12-31')).toEqual(['2026-11-03', '2026-11-17']);
    expect(finalDayOf(d)).toBe('2026-11-17');
  });

  test('with no end it keeps going; a one-off ends on its day', () => {
    expect(finalDayOf(event({ weekly: {} }))).toBeNull();
    expect(daysOf(event({ weekly: {} }), '2027-06-01', '2027-06-07')).toEqual(['2027-06-01']);
    expect(finalDayOf(event({ end: '2026-11-04' }))).toBe('2026-11-04');
  });

  test('a start off the rule moves to the first day it allows', () => {
    expect(event({ start: '2026-11-02', weekly: { days: ['TH'] } }).start).toBe('2026-11-05');
  });
});

describe('who sees it', () => {
  const d = event({ audience: [{ circleId: 'fam' }, { circleId: 'crew', people: ['carol'] }] });
  test('everyone in a whole circle, only the chosen in another, always the creator', () => {
    expect(canSee(d, 'fam', 'bob')).toBe(true);
    expect(canSee(d, 'crew', 'carol')).toBe(true);
    expect(canSee(d, 'crew', 'dave')).toBe(false);
    expect(canSee(d, 'elsewhere', 'bob')).toBe(false);
    expect(canSee(d, 'crew', 'alice')).toBe(true);
  });

  test('the weeks ahead leave out what the viewer is not invited to', () => {
    const v = plansView(
      'dave',
      ['alice', 'dave'],
      [d].filter((x) => canSee(x, 'crew', 'dave')),
      {},
      '2026-11-01',
      '2026-11-14',
    );
    expect(v.drops).toEqual([]);
  });
});

describe('checking what is sent', () => {
  test.each([
    [{ start: '2026-11-03' }, 'title is required'],
    [{ title: 'x', start: 'Tuesday' }, 'start is YYYY-MM-DD'],
    [{ title: 'x', start: '2026-11-03', time: { start: '4:30pm' } }, 'time.start is HH:MM'],
    [{ title: 'x', start: '2026-11-03', zone: 'Mars/Base' }, 'zone is an IANA time zone'],
    [{ title: 'x', start: '2026-11-03', weekly: { days: ['XX'] } }, 'weekly.days are MO..SU'],
    [{ title: 'x', start: '2026-11-03', audience: [] }, 'audience is 1 to 10 circles'],
  ])('%j is turned away', (raw, error) => {
    expect(cleanEvent(raw, base)).toEqual({ ok: false, error });
  });

  test('a timed event gets the circle zone unless told', () => {
    expect(event({ time: { start: '16:30' } }).zone).toBe('America/New_York');
    expect(event({ time: { start: '16:30' }, zone: 'Europe/Dublin' }).zone).toBe('Europe/Dublin');
    expect(event({}).zone).toBeUndefined();
  });
});

describe('the calendar file', () => {
  test('a zoned wall clock to UTC, across daylight saving', () => {
    expect(zonedToUtc('2026-07-01', '16:30', 'America/New_York')).toBe('20260701T203000Z');
    expect(zonedToUtc('2026-12-01', '16:30', 'America/New_York')).toBe('20261201T213000Z');
  });

  test('a repeating timed event: TZID, RRULE, EXDATE, escaped text', () => {
    const ics = eventIcs(
      event({
        time: { start: '17:30', end: '18:30' },
        place: 'Springfield Gym, back door',
        details: 'Anyone can come; bring water',
        weekly: { days: ['TU', 'TH'], until: '2026-12-17' },
        skip: ['2026-11-26'],
      }),
      new Date('2026-11-01T12:00:00Z'),
    );
    const lines = ics.split('\r\n');
    expect(lines).toEqual(
      expect.arrayContaining([
        'UID:alice-e1@family-trivia',
        'DTSTAMP:20261101T120000Z',
        'DTSTART;TZID=America/New_York:20261103T173000',
        'DTEND;TZID=America/New_York:20261103T183000',
        'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218T045900Z',
        'EXDATE;TZID=America/New_York:20261126T173000',
        'LOCATION:Springfield Gym\\, back door',
        'DESCRIPTION:Anyone can come\\; bring water',
        'STATUS:CONFIRMED',
      ]),
    );
  });

  test('an all-day event spans whole days; a cancelled one says so', () => {
    const ics = eventIcs(event({ end: '2026-11-04', cancelled: true }));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261103\r\nDTEND;VALUE=DATE:20261105');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(icsFileName(event({ title: "Carol's birthday!" }))).toBe('carols-birthday.ics');
  });

  test('long lines fold at 75 octets', () => {
    const ics = eventIcs(event({ details: 'é'.repeat(120) }));
    for (const line of ics.split('\r\n'))
      expect(encodeURIComponent(line).replace(/%[0-9A-F]{2}/g, 'x').length).toBeLessThanOrEqual(75);
  });
});
