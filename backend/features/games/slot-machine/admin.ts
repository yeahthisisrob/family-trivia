/** The Slot Machine in the admin views: open spins, one player's state, a reset. */
import type { OpenSession, PlayerSession } from '../../../services/gameRegistry';
import { deleteObject, getJson, listObjects } from '../../../services/s3';
import type { SlotMachineSession } from './handlers';
import { keys, STORAGE } from './keys';

/** Every player's spin that isn't finished. */
export async function openSessions(): Promise<OpenSession[]> {
  const out: OpenSession[] = [];
  const latest = (await listObjects(STORAGE)).filter((k) => k.endsWith('/session.json'));
  for (const key of latest) {
    try {
      const session = await getJson<SlotMachineSession>(key);
      if (!session || session.status === 'completed') continue;
      out.push({
        userId: key.split('/')[1] as string,
        status: session.status || 'unknown',
        questions: 0,
        answered: 0,
        startTime: session.lastPlayedAt ? new Date(session.lastPlayedAt).toISOString() : 'unknown',
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function playerSession(userId: string): Promise<PlayerSession> {
  try {
    const session = await getJson<SlotMachineSession>(keys.session(userId));
    return {
      status: session?.status || 'none',
      lastPlayed: session?.lastPlayedAt ? new Date(session.lastPlayedAt).toISOString() : null,
      details: session?.result
        ? `${session.result.multiplier}× ${session.result.category}`
        : 'No session',
    };
  } catch {
    return { status: 'none', lastPlayed: null, details: 'No session' };
  }
}

/** Removes the latest spin (it holds the last-played time) and the stats. */
export async function resetPlayer(userId: string): Promise<string[]> {
  const removed: string[] = [];
  for (const [key, name] of [
    [keys.session(userId), 'slot-machine/session'],
    [keys.stats(userId), 'slot-machine/stats'],
  ] as const) {
    try {
      await deleteObject(key);
      removed.push(name);
    } catch {
      /* doesn't exist */
    }
  }
  return removed;
}
