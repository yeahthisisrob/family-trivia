/** An event's time and rule in words (docs/decisions/0036). */
import { type Drop, WEEKDAYS, type Weekday, type Weekly } from '@family-trivia/shared';

const at = (d: string) => new Date(`${d}T12:00:00`);
export const shortDay = (d: string) =>
  at(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** "16:30" as the reader's clock writes it ("4:30 PM"). */
export function clockText(t: string): string {
  const [h, m] = t.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

const DAY_NAMES: Record<Weekday, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};
export const dayLabel = (d: Weekday) => DAY_NAMES[d];

const list = (xs: string[]) =>
  xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** "Every Tue and Thu, until Mar 30" for a weekly rule starting on `start`. */
export function repeatText(rule: Weekly, start: string): string {
  const startDay = WEEKDAYS[(at(start).getDay() + 6) % 7] as Weekday;
  const days = (rule.days?.length ? rule.days : [startDay])
    .slice()
    .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
    .map(dayLabel);
  const every = rule.every && rule.every > 1 ? `Every ${rule.every} weeks on` : 'Every';
  const end = rule.until
    ? `, until ${shortDay(rule.until)}`
    : rule.count
      ? `, ${rule.count} times`
      : '';
  return `${every} ${list(days)}${end}`;
}

/** The event's times, with its zone named when it isn't the reader's. */
export function timeText(d: Drop): string {
  if (!d.time) return 'All day';
  const span = d.time.end
    ? `${clockText(d.time.start)} to ${clockText(d.time.end)}`
    : clockText(d.time.start);
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!d.zone || d.zone === mine) return span;
  const zone = new Intl.DateTimeFormat(undefined, { timeZone: d.zone, timeZoneName: 'short' })
    .formatToParts(at(d.start))
    .find((p) => p.type === 'timeZoneName')?.value;
  return `${span} ${zone ?? d.zone}`;
}

/** When, in one line: the day (the one opened, for a repeating event, or its first) and the time. */
export function whenText(d: Drop, day?: string): string {
  const first = d.weekly
    ? shortDay(day ?? d.start)
    : `${shortDay(d.start)}${d.end ? ` to ${shortDay(d.end)}` : ''}`;
  return `${first} · ${timeText(d)}`;
}
