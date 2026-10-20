/**
 * Life events (docs/decisions/0018): the moments a circle knows of one
 * person's life. Each feature adds its own with addLifeEvents, so the
 * timeline that shows them (Your world) never lists where they come from.
 * Sources run in the circle being read; one that fails is skipped.
 */
import type { LifeEvent } from '@family-trivia/shared';
import { logger } from './logger';

type Source = (me: string) => Promise<Omit<LifeEvent, 'circleId'>[]>;

const sources: { name: string; read: Source }[] = [];

export function addLifeEvents(name: string, read: Source): void {
  if (!sources.some((s) => s.name === name)) sources.push({ name, read });
}

/** Everything every source knows about `me` in the current circle. */
export async function lifeEventsOf(me: string): Promise<Omit<LifeEvent, 'circleId'>[]> {
  const all = await Promise.all(
    sources.map((s) =>
      s.read(me).catch((err: unknown) => {
        logger.warn('Life events source failed', {
          source: s.name,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
    ),
  );
  return all.flat();
}
