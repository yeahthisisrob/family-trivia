/**
 * A memory a day (shared/src/look-back.ts DailyMemory): one past question
 * and everyone's answers, the same for the whole family all day. A question
 * asked on this calendar day in an earlier year comes first; otherwise a
 * well-answered day from the archive, chosen by the date so it's steady.
 */
import { type DailyMemory, getEasternDateString } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { getFactHistory } from '../../services/factHistoryService';
import { loadJoined } from '../../services/family/joined';

/** Fewest answers for a day to be worth bringing back. */
const ENOUGH = 2;

/** FNV-1a: the same day always picks the same memory. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export async function pickMemory(today: string): Promise<DailyMemory | null> {
  const { visible } = await loadJoined();
  const ids = Object.keys(visible.people);
  const histories = await Promise.all(ids.map((id) => getFactHistory(id)));
  const days = new Map<string, Omit<DailyMemory, 'date' | 'kind'>>();
  ids.forEach((personId, i) => {
    for (const e of histories[i] ?? []) {
      if (e.questionType !== 'shared' || !e.answered || e.skipped || !e.answer?.trim()) continue;
      const asked = e.date || e.timestamp.slice(0, 10);
      if (asked >= today) continue;
      const key = `${asked}|${e.question}`;
      const day = days.get(key) ?? { asked, question: e.question, answers: [] };
      if (!day.answers.some((a) => a.personId === personId))
        day.answers.push({ id: `${personId}_${e.timestamp}`, personId, answer: e.answer.trim() });
      days.set(key, day);
    }
  });
  const worth = [...days.entries()]
    .filter(([, d]) => d.answers.length >= ENOUGH)
    .sort(([a], [b]) => a.localeCompare(b));
  if (!worth.length) return null;

  const onThisDay = worth
    .map(([, d]) => d)
    .filter((d) => d.asked.slice(5) === today.slice(5))
    .sort((a, b) => b.answers.length - a.answers.length)[0];
  if (onThisDay) return { ...onThisDay, date: today, kind: 'on-this-day' };

  const [, chosen] = worth[hash(today) % worth.length] ?? worth[0] ?? [];
  return chosen ? { ...chosen, date: today, kind: 'from-our-pages' } : null;
}

/** GET /family/memory: today's memory, or null while there's nothing to bring back. */
export async function getDailyMemory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const asked = event.queryStringParameters?.date;
  const today = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : getEasternDateString();
  if (today > getEasternDateString()) return errorResponse('Not a day yet', 400);
  return successResponse({ memory: await pickMemory(today) });
}
