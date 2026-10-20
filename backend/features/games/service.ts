/**
 * What every game gets without a backend of its own (docs/decisions/0032):
 * a scoreboard, a small save per player, and clues made from the circle's
 * own trivia and answers. A game is only an id here; nothing lists them.
 */
import type { GameClue } from '@family-trivia/shared';
import { getAllFactHistories } from '../../services/factHistoryService';
import { loadHierarchy } from '../../services/family/roster';
import { logger } from '../../services/logger';
import { getAllQuestionsFlat } from '../../services/questionHistoryService';
import { getJson, putJson } from '../../services/s3';

/** A game id: lowercase words joined by dashes, as its folder is named. */
export const GAME_ID = /^[a-z][a-z0-9-]{1,31}$/;

/** A save is for progress and settings, not a database. */
export const SAVE_LIMIT = 16_000;

const saveKey = (game: string, userId: string) => `games/saves/${game}/${userId}.json`;

export async function readSave(game: string, userId: string): Promise<unknown> {
  return (await getJson<{ save: unknown }>(saveKey(game, userId)))?.save ?? null;
}

export async function writeSave(game: string, userId: string, save: unknown): Promise<void> {
  await putJson(saveKey(game, userId), { save, at: new Date().toISOString() });
}

const letters = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

/**
 * Clues with one-word answers, from trivia already asked in this circle and
 * from what people answered about themselves ("Bob: favorite food?" → TACOS).
 */
export async function clues(opts: {
  count: number;
  minLength: number;
  maxLength: number;
}): Promise<GameClue[]> {
  const out: GameClue[] = [];
  const seen = new Set<string>();
  const fits = (a: string) =>
    a.length >= opts.minLength && a.length <= opts.maxLength && !seen.has(a);
  const add = (c: GameClue) => {
    seen.add(c.answer);
    out.push(c);
  };

  try {
    for (const q of await getAllQuestionsFlat()) {
      if (!q.answer || !q.question) continue;
      const a = letters(q.answer.trim());
      if (fits(a)) add({ clue: q.question, answer: a, from: 'trivia' });
    }
  } catch {
    logger.debug('No trivia history for game clues');
  }

  try {
    const [histories, hierarchy] = await Promise.all([
      getAllFactHistories(),
      loadHierarchy<{ family?: { people?: Record<string, { name?: string }> } }>(),
    ]);
    const people = hierarchy?.family?.people ?? {};
    for (const [userId, entries] of histories) {
      const name = people[userId]?.name ?? userId;
      for (const e of entries) {
        if (!e.answered || e.skipped || !e.answer) continue;
        const a = e.answer.trim().split(/\s+/).map(letters).find(fits);
        if (a) add({ clue: `${name}: ${e.question}`, answer: a, from: 'answers', about: userId });
      }
    }
  } catch {
    logger.debug('No answers for game clues');
  }

  return out.sort(() => Math.random() - 0.5).slice(0, opts.count);
}
