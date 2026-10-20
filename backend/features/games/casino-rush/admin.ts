/** Casino Rush in the admin views: open plays, one player's state, a reset. */
import type { OpenSession, PlayerSession } from '../../../services/gameRegistry';
import { deleteObject, getJson, listObjects } from '../../../services/s3';
import { keys, STORAGE } from './keys';
import type { CasinoRushSession } from './sessions';

/** Every player's current play, finished or not. */
export async function openSessions(): Promise<OpenSession[]> {
  const out: OpenSession[] = [];
  const current = (await listObjects(STORAGE)).filter((k) => k.endsWith('/current-session.json'));
  for (const key of current) {
    try {
      const session = await getJson<CasinoRushSession>(key);
      if (!session) continue;
      out.push({
        userId: key.split('/')[1] as string,
        status: session.status || 'unknown',
        questions: session.questions?.length || 0,
        answered: session.questions?.filter((q) => q.answeredAt)?.length || 0,
        startTime: session.startTime ? new Date(session.startTime).toISOString() : 'unknown',
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function playerSession(userId: string): Promise<PlayerSession> {
  try {
    const session = await getJson<CasinoRushSession>(keys.current(userId));
    const history = await getJson<{ lastPlayedAt?: number }>(keys.history(userId));
    return {
      status: session?.status || 'none',
      lastPlayed: history?.lastPlayedAt ? new Date(history.lastPlayedAt).toISOString() : null,
      details: session
        ? `Q${(session.currentQuestionIndex || 0) + 1}/${session.questions?.length || 0}`
        : 'No session',
    };
  } catch {
    return { status: 'none', lastPlayed: null, details: 'No session' };
  }
}

/** Removes the current play and the old cooldown file. */
export async function resetPlayer(userId: string): Promise<string[]> {
  const removed: string[] = [];
  for (const [key, name] of [
    [keys.current(userId), 'casino-rush/current-session'],
    [keys.history(userId), 'casino-rush/history'],
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
