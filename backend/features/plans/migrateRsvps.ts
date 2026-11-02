/**
 * One-time: answers to plans were "in" or "out"; since docs/decisions/0036
 * each is { answer, note?, guests?, at }. Rewrites every circle's
 * plans/rsvp/ files. Reports what it would change unless `apply`.
 */
import type { RsvpEntry } from '@family-trivia/shared';
import { listCircles, scopeOf } from '../../services/circles';
import { getJson, listObjects, putJson } from '../../services/s3';
import { inCircle } from '../../services/scope';

type Stored = Record<string, RsvpEntry | 'in' | 'out'>;

export async function migrateRsvps(
  apply: boolean,
  now = new Date().toISOString(),
): Promise<{ circleId: string; files: number; changed: number }[]> {
  const report = [];
  for (const circle of await listCircles()) {
    const result = await inCircle(scopeOf(circle), async () => {
      const keys = await listObjects('plans/rsvp/');
      let changed = 0;
      for (const key of keys) {
        const stored = (await getJson<Stored>(key)) ?? {};
        if (!Object.values(stored).some((v) => typeof v === 'string')) continue;
        changed++;
        const next = Object.fromEntries(
          Object.entries(stored).map(([who, v]) => [
            who,
            typeof v === 'string' ? { answer: v, at: now } : v,
          ]),
        );
        if (apply) await putJson(key, next);
      }
      return { circleId: circle.id, files: keys.length, changed };
    });
    report.push(result);
  }
  return report;
}
