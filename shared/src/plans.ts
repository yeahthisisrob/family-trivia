/**
 * Plans (docs/decisions/0026): drop in what you're doing, in a few words,
 * and the circle sees the weeks ahead at a glance: who's away, who's free,
 * what's planned and who's in. No calendar to connect; the words are enough.
 */

/** Away or tied up; free and up for something; or a plan others can join. */
export type DropKind = 'busy' | 'free' | 'plan';

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'all-day';

/** One thing someone dropped in. Dates are YYYY-MM-DD in the circle's day (ET). */
export interface Drop {
  id: string;
  by: string;
  kind: DropKind;
  title: string;
  start: string;
  /** Last day, for something that spans days. */
  end?: string;
  part?: DayPart;
  /** Every week on the start's weekday, until `until` (or for the next three months). */
  weekly?: { until?: string };
  /** The words they typed, kept so it can be read back. */
  said?: string;
  createdAt: string;
}

export type Rsvp = 'in' | 'out';

/** One day in the weeks ahead. */
export interface PlanDay {
  date: string;
  /** Who's busy, and who said they're free. */
  busy: string[];
  free: string[];
  /** Drops (ids) on this day that others can see in full: plans and free times. */
  plans: string[];
}

export interface PlansView {
  days: PlanDay[];
  /** Everything the days point at. Others' busy drops come back as just "Busy". */
  drops: Drop[];
  /** Drop id → who's in or out. */
  rsvps: Record<string, Record<string, Rsvp>>;
  /** Days most people are free, best first (at most 3). */
  best: string[];
}

const DAY_MS = 86_400_000;
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fromDay = (d: string) => Date.parse(`${d}T12:00:00Z`);

/** Every day in [from, to], inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = fromDay(from); t <= fromDay(to); t += DAY_MS) out.push(toDay(t));
  return out;
}

export const addDays = (d: string, n: number) => toDay(fromDay(d) + n * DAY_MS);

/** The days a drop falls on within [from, to]. */
export function daysOf(d: Drop, from: string, to: string): string[] {
  const last = d.end && d.end >= d.start ? d.end : d.start;
  const span = Math.round((fromDay(last) - fromDay(d.start)) / DAY_MS);
  const starts = d.weekly
    ? daysBetween(d.start, d.weekly.until ?? addDays(d.start, 91)).filter((_, i) => i % 7 === 0)
    : [d.start];
  const out = new Set<string>();
  for (const s of starts)
    for (let i = 0; i <= span; i++) {
      const day = addDays(s, i);
      if (day >= from && day <= to) out.add(day);
    }
  return [...out];
}

/**
 * The weeks ahead for one viewer: each day's busy and free people and the
 * plans on it, and the best days to get together. `people` are everyone who
 * could come.
 */
export function plansView(
  viewer: string,
  people: string[],
  drops: Drop[],
  rsvps: PlansView['rsvps'],
  from: string,
  to: string,
): PlansView {
  const days: PlanDay[] = daysBetween(from, to).map((date) => ({
    date,
    busy: [],
    free: [],
    plans: [],
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const shown: Drop[] = [];
  for (const d of drops) {
    const on = daysOf(d, from, to);
    if (!on.length) continue;
    // Someone else's busy time is theirs: the circle sees "Busy", not why.
    shown.push(d.kind === 'busy' && d.by !== viewer ? { ...d, title: 'Busy', said: undefined } : d);
    for (const date of on) {
      const day = byDate.get(date);
      if (!day) continue;
      if (d.kind === 'busy') {
        if (!day.busy.includes(d.by)) day.busy.push(d.by);
      } else {
        if (d.kind === 'free' && !day.free.includes(d.by)) day.free.push(d.by);
        day.plans.push(d.id);
      }
    }
  }
  const best = days
    .filter((d) => people.length > 1 && d.busy.length === 0 && d.date > from)
    .map((d) => ({ d, score: d.free.length * 2 + (isWeekend(d.date) ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d.date.localeCompare(b.d.date))
    .slice(0, 3)
    .map((x) => x.d.date);
  return { days, drops: shown, rsvps, best };
}

export const isWeekend = (d: string) => {
  const day = new Date(fromDay(d)).getUTCDay();
  return day === 0 || day === 6;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: DropKind[] = ['busy', 'free', 'plan'];
const PARTS: DayPart[] = ['morning', 'afternoon', 'evening', 'all-day'];

/** A drop as the AI (or anyone) proposed it, checked and made safe, or null. */
export function cleanDrop(
  raw: unknown,
  base: Pick<Drop, 'id' | 'by' | 'createdAt' | 'said'>,
): Drop | null {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== 'object') return null;
  const kind = KINDS.includes(r.kind as DropKind) ? (r.kind as DropKind) : null;
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 80) : '';
  const start = typeof r.start === 'string' && DATE.test(r.start) ? r.start : null;
  if (!kind || !title || !start) return null;
  const end =
    typeof r.end === 'string' && DATE.test(r.end) && r.end > start && r.end <= addDays(start, 60)
      ? r.end
      : undefined;
  const part = PARTS.includes(r.part as DayPart) ? (r.part as DayPart) : undefined;
  const until =
    typeof r.until === 'string' && DATE.test(r.until) && r.until > start ? r.until : undefined;
  return {
    ...base,
    kind,
    title,
    start,
    ...(end ? { end } : {}),
    ...(part ? { part } : {}),
    ...(r.weekly === true ? { weekly: until ? { until } : {} } : {}),
  };
}

// ── After the day (docs/decisions/0026) ──────────────────────────────────

/** A memory someone added to a plan once its day had passed. */
export interface PlanMemory {
  by: string;
  text: string;
  at: string;
}

/** A recent plan the viewer was part of, and what people remember of it. */
export interface AfterPlan {
  drop: Drop;
  /** Who was in: the person who made it, and everyone who said they were in. */
  who: string[];
  memories: PlanMemory[];
}

/** How long a plan asks for memories after its last day. */
export const AFTER_DAYS = 14;

/** The last day a drop happens on (a weekly drop's most recent day before `today`). */
export function lastDayOf(d: Drop, today: string): string | null {
  const from = addDays(today, -AFTER_DAYS);
  const days = daysOf(d, from, addDays(today, -1));
  return days.length ? (days[days.length - 1] as string) : null;
}
