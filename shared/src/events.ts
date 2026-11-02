/**
 * Events (docs/decisions/0036): a plan with a time, a place, a word about it,
 * a weekly rule and the people it's for. One check for what anyone sends
 * (the app, or another app with the person's token), and one calendar file.
 */
import {
  type AudienceCircle,
  addDays,
  DEFAULT_ZONE,
  type Drop,
  WEEKDAYS,
  type Weekday,
  type Weekly,
} from './plans';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const LIMITS = { title: 80, place: 200, details: 2000, skip: 200, audience: 10, count: 520 };

const isDate = (v: unknown): v is string =>
  typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

export const isZone = (v: unknown): v is string => {
  if (typeof v !== 'string' || !v) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v });
    return true;
  } catch {
    return false;
  }
};

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false, error }) as const;

function cleanTime(raw: unknown): Checked<Drop['time']> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  const r = raw as Record<string, unknown>;
  if (typeof r !== 'object' || typeof r.start !== 'string' || !CLOCK.test(r.start))
    return fail('time.start is HH:MM');
  if (r.end === undefined) return { ok: true, value: { start: r.start } };
  if (typeof r.end !== 'string' || !CLOCK.test(r.end)) return fail('time.end is HH:MM');
  return { ok: true, value: { start: r.start, end: r.end } };
}

function cleanWeekly(raw: unknown, start: string): Checked<Weekly | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  const r = raw as Record<string, unknown>;
  if (typeof r !== 'object') return fail('weekly is an object');
  const days = Array.isArray(r.days)
    ? [...new Set(r.days)].filter((d): d is Weekday => WEEKDAYS.includes(d as Weekday))
    : [];
  if (Array.isArray(r.days) && days.length !== r.days.length) return fail('weekly.days are MO..SU');
  const every = r.every === undefined ? 1 : Number(r.every);
  if (!Number.isInteger(every) || every < 1 || every > 4) return fail('weekly.every is 1 to 4');
  if (r.until !== undefined && !(isDate(r.until) && r.until >= start))
    return fail('weekly.until is a date on or after start');
  const count = r.count === undefined ? undefined : Number(r.count);
  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > LIMITS.count))
    return fail(`weekly.count is 1 to ${LIMITS.count}`);
  return {
    ok: true,
    value: {
      ...(days.length ? { days: WEEKDAYS.filter((d) => days.includes(d)) } : {}),
      ...(every > 1 ? { every } : {}),
      ...(isDate(r.until) ? { until: r.until } : {}),
      ...(count ? { count } : {}),
    },
  };
}

function cleanAudience(raw: unknown): Checked<AudienceCircle[] | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (!Array.isArray(raw) || !raw.length || raw.length > LIMITS.audience)
    return fail(`audience is 1 to ${LIMITS.audience} circles`);
  const out: AudienceCircle[] = [];
  for (const a of raw as Record<string, unknown>[]) {
    if (!a || typeof a.circleId !== 'string' || !a.circleId) return fail('audience needs circleId');
    if (out.some((o) => o.circleId === a.circleId)) return fail('a circle is in audience twice');
    if (a.people === undefined) out.push({ circleId: a.circleId });
    else if (
      Array.isArray(a.people) &&
      a.people.length &&
      a.people.every((p) => typeof p === 'string' && p)
    )
      out.push({ circleId: a.circleId, people: [...new Set(a.people as string[])] });
    else return fail('audience people are ids, at least one');
  }
  return { ok: true, value: out };
}

/** The first day on or after `start` that the rule's days allow. */
function firstDay(start: string, weekly: Weekly | undefined): string {
  if (!weekly?.days?.length) return start;
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const wd = WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7] as Weekday;
    if (weekly.days.includes(wd)) return day;
  }
  return start;
}

/**
 * An event as someone sent it, checked: the fields of a Drop that make it
 * an event, or what's wrong. `base` is who made it and when (kept on change).
 */
export function cleanEvent(
  raw: unknown,
  base: Pick<Drop, 'id' | 'by' | 'createdAt'> & { updatedAt?: string },
): Checked<Drop> {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== 'object') return fail('Send the event as JSON');
  const title = text(r.title, LIMITS.title);
  if (!title) return fail('title is required');
  if (!isDate(r.start)) return fail('start is YYYY-MM-DD');
  const time = cleanTime(r.time);
  if (!time.ok) return time;
  const weekly = cleanWeekly(r.weekly, r.start);
  if (!weekly.ok) return weekly;
  const start = firstDay(r.start, weekly.value);
  if (r.end !== undefined && !(isDate(r.end) && r.end >= start && r.end <= addDays(start, 60)))
    return fail('end is a date within 60 days after start');
  const end = isDate(r.end) && r.end > start ? r.end : undefined;
  if (r.zone !== undefined && !isZone(r.zone)) return fail('zone is an IANA time zone');
  const audience = cleanAudience(r.audience);
  if (!audience.ok) return audience;
  if (r.skip !== undefined && !(Array.isArray(r.skip) && r.skip.every(isDate)))
    return fail('skip is a list of dates');
  const skip = [...new Set((r.skip as string[] | undefined) ?? [])].sort().slice(0, LIMITS.skip);
  const place = text(r.place, LIMITS.place);
  const details = text(r.details, LIMITS.details);
  return {
    ok: true,
    value: {
      ...base,
      kind: 'plan',
      title,
      start,
      ...(end ? { end } : {}),
      ...(time.value ? { time: time.value, zone: isZone(r.zone) ? r.zone : DEFAULT_ZONE } : {}),
      ...(place ? { place } : {}),
      ...(details ? { details } : {}),
      ...(weekly.value ? { weekly: weekly.value } : {}),
      ...(skip.length ? { skip } : {}),
      ...(audience.value ? { audience: audience.value } : {}),
      ...(r.cancelled === true ? { cancelled: true } : {}),
    },
  };
}

/** Whether a plan is an event: it has a time, a place, details or an audience (not a drop-in). */
export const isEvent = (d: Drop) =>
  !!(d.time || d.place || d.details || d.audience || d.cancelled || d.skip);

// ── ICS (RFC 5545) ────────────────────────────────────────────────────────

const compact = (d: string) => d.replace(/-/g, '');
const clock = (t: string) => `${t.replace(':', '')}00`;

/** The UTC instant of a wall-clock time in a zone, as YYYYMMDDTHHMMSSZ. */
export function zonedToUtc(day: string, time: string, zone: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // What the zone's clock reads at that instant tells how far off it is.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const read = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (read - guess))
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Text as RFC 5545 writes it: backslash, semicolon, comma and newline escaped. */
const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** How many UTF-8 octets a string takes. */
const octets = (s: string) => encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, 'x').length;

/** Lines longer than 75 octets continue on the next line after a space (RFC 5545 3.1). */
function fold(line: string): string {
  if (octets(line) <= 75) return line;
  const out: string[] = [];
  let current = '';
  for (const ch of line) {
    const limit = out.length ? 74 : 75;
    if (octets(current + ch) > limit) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join('\r\n ');
}

function rrule(d: Drop): string | null {
  const w = d.weekly;
  if (!w) return null;
  const parts = ['FREQ=WEEKLY'];
  if (w.every && w.every > 1) parts.push(`INTERVAL=${w.every}`);
  if (w.days?.length) parts.push(`BYDAY=${w.days.join(',')}`);
  if (w.until)
    parts.push(
      `UNTIL=${d.time ? zonedToUtc(w.until, '23:59', d.zone ?? DEFAULT_ZONE) : compact(w.until)}`,
    );
  else if (w.count) parts.push(`COUNT=${w.count}`);
  return `RRULE:${parts.join(';')}`;
}

/**
 * One event as a calendar file: one VEVENT, its weekly rule and skipped
 * days, the zone named by its IANA id (calendars read it without a
 * VTIMEZONE block). `stamp` is when the file was made.
 */
export function eventIcs(d: Drop, stamp = new Date()): string {
  const zone = d.zone ?? DEFAULT_ZONE;
  const lastDay = d.end ?? d.start;
  const endDay = d.time?.end && d.time.end <= d.time.start ? addDays(lastDay, 1) : lastDay;
  const when = d.time
    ? [
        `DTSTART;TZID=${zone}:${compact(d.start)}T${clock(d.time.start)}`,
        d.time.end ? `DTEND;TZID=${zone}:${compact(endDay)}T${clock(d.time.end)}` : 'DURATION:PT1H',
      ]
    : [
        `DTSTART;VALUE=DATE:${compact(d.start)}`,
        `DTEND;VALUE=DATE:${compact(addDays(lastDay, 1))}`,
      ];
  const skipped = (d.skip ?? []).map((day) =>
    d.time
      ? `EXDATE;TZID=${zone}:${compact(day)}T${clock(d.time.start)}`
      : `EXDATE;VALUE=DATE:${compact(day)}`,
  );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Trivia//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${d.id}@family-trivia`,
    `DTSTAMP:${stamp
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')}`,
    ...when,
    ...[rrule(d)].filter((l): l is string => !!l),
    ...skipped,
    `SUMMARY:${icsText(d.title)}`,
    ...(d.place ? [`LOCATION:${icsText(d.place)}`] : []),
    ...(d.details ? [`DESCRIPTION:${icsText(d.details)}`] : []),
    `STATUS:${d.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** A file name for an event's calendar file. */
export const icsFileName = (d: Drop) =>
  `${
    d.title
      .replace(/[^\w -]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'event'
  }.ics`;
