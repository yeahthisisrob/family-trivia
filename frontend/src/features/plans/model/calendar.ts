/**
 * The Events calendar's days (after Herd's MonthGrid): a month as whole
 * weeks, Monday first, and each day's events from the plans view, a
 * repeating one on every day it happens (the server expands the rule).
 */
import { addDays, type Drop, type PlansView } from '@family-trivia/shared';

const weekdayIndex = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;

/** The days a month grid shows for `month` (YYYY-MM): Monday of its first week to Sunday of its last. */
export function monthWindow(month: string): { from: string; to: string } {
  const first = `${month}-01`;
  const next = shiftMonth(month, 1);
  const last = addDays(`${next}-01`, -1);
  return { from: addDays(first, -weekdayIndex(first)), to: addDays(last, 6 - weekdayIndex(last)) };
}

/** `month` moved by `n` months (YYYY-MM). */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const at = new Date(Date.UTC(y, m - 1 + n, 1));
  return at.toISOString().slice(0, 7);
}

/** Every day in [from, to]. */
export function daysIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Plans and events (not busy or free time) on each day, by time of day. */
export function eventsByDay(view: PlansView): Map<string, Drop[]> {
  const byId = new Map(view.drops.map((d) => [d.id, d]));
  const out = new Map<string, Drop[]>();
  for (const day of view.days) {
    const on = day.plans
      .map((id) => byId.get(id))
      .filter((d): d is Drop => !!d && d.kind === 'plan')
      .sort((a, b) => (a.time?.start ?? '').localeCompare(b.time?.start ?? ''));
    if (on.length) out.set(day.date, on);
  }
  return out;
}
