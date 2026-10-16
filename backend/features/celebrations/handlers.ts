/** Birthdays and the celebrations the family adds (dates.ts). */
import {
  type Birthday,
  CELEBRATION_TYPES,
  type Celebration,
  type CelebrationType,
  getDaysUntilET,
  isMonthDay,
  isTodayET,
} from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { loadFamily } from '../../services/family/roster';
import { mmdd, personBirthdays, readCelebrations, writeCelebrations } from './dates';

const MAX_UPCOMING = 100;
const MAX_NAME = 80;
const MAX_DESCRIPTION = 300;

const when = (month: number, day: number) => {
  const isToday = isTodayET(month, day);
  const daysUntil = isToday ? 0 : getDaysUntilET(month, day);
  return { daysUntil, isToday, isPast: daysUntil > 300 };
};

const monthDayOf = (date: string) => {
  const [m, d] = date.split('/').map(Number);
  return { month: m ?? 0, day: d ?? 0 };
};

/** GET /upcoming-birthdays?limit=N: today's dates, and the next ones in order. */
export async function getUpcoming(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const [people, { celebrations }] = await Promise.all([personBirthdays(), readCelebrations()]);
  const all: Birthday[] = [
    ...people.map((b) => ({
      userId: b.personId,
      name: b.name,
      birthday: b.raw,
      month: b.month,
      day: b.day,
      ...when(b.month, b.day),
      type: 'birthday' as const,
      isFromFacts: true,
      ...(b.remembered ? { remembered: true } : {}),
    })),
    ...celebrations
      .map((c) => ({ c, ...monthDayOf(c.date) }))
      .filter(({ month, day }) => isMonthDay(month, day))
      .map(({ c, month, day }) => ({
        userId: c.addedBy,
        name: c.name,
        birthday: c.date,
        month,
        day,
        ...when(month, day),
        type: c.type,
        description: c.description,
        year: c.year,
        celebrationId: c.id,
        isFromFacts: false,
      })),
  ].sort((a, b) => a.daysUntil - b.daysUntil);

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 10, MAX_UPCOMING);
  return successResponse({
    birthdays: all.filter((b) => !b.isToday).slice(0, limit),
    todaysBirthdays: all.filter((b) => b.isToday),
  });
}

/** GET /celebrations: every date in the year, people's birthdays included. */
export async function getAll(): Promise<APIGatewayProxyResult> {
  const [people, stored, family] = await Promise.all([
    personBirthdays(),
    readCelebrations(),
    loadFamily(),
  ]);
  const added: Celebration[] = stored.celebrations.map((c) => ({
    ...c,
    addedByName: family.people[c.addedBy]?.name ?? c.addedBy,
    isManual: true,
  }));
  // Someone may have added a birthday by hand that the family also knows.
  const known = new Set(added.filter((c) => c.type === 'birthday').map((c) => c.date));
  const birthdays: Celebration[] = people
    .filter((b) => !known.has(mmdd(b.month, b.day)))
    .map((b) => ({
      id: `fact-birthday-${b.personId}`,
      type: 'birthday',
      name: `${b.name}'s Birthday`,
      date: mmdd(b.month, b.day),
      addedBy: 'system',
      addedByName: 'From facts',
      addedAt: b.answeredAt ?? stored.lastUpdated,
      recurring: true,
      isFromFacts: true,
      ...(b.remembered ? { remembered: true } : {}),
    }));
  const celebrations = [...added, ...birthdays].sort((a, b) => a.date.localeCompare(b.date));
  return successResponse({ celebrations, lastUpdated: stored.lastUpdated });
}

/** POST /celebrations {type, name, date: MM/DD, description?, recurring?, year?}: the caller adds one. */
export async function add(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return errorResponse('Body must be JSON', 400);
  }
  const type = body.type as CelebrationType;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const date = typeof body.date === 'string' ? body.date : '';
  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, MAX_DESCRIPTION)
      : undefined;
  const year = typeof body.year === 'number' && Number.isInteger(body.year) ? body.year : undefined;
  if (!CELEBRATION_TYPES.includes(type)) return errorResponse('Unknown kind of date', 400);
  if (!name || name.length > MAX_NAME) return errorResponse('Give it a name', 400);
  const { month, day } = monthDayOf(date);
  if (!/^\d{2}\/\d{2}$/.test(date) || !isMonthDay(month, day))
    return errorResponse('Dates look like MM/DD', 400);

  const { celebrations } = await readCelebrations();
  const celebration: Celebration = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type,
    name,
    date,
    description,
    addedBy: userId,
    addedAt: new Date().toISOString(),
    recurring: body.recurring !== false,
    year,
  };
  await writeCelebrations([...celebrations, celebration]);
  return successResponse({ success: true, celebration });
}

/** DELETE /celebrations?id=X: only what the caller added. */
export async function remove(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const id = event.queryStringParameters?.id;
  if (!id) return errorResponse('Which date?', 400);
  const { celebrations } = await readCelebrations();
  const found = celebrations.find((c) => c.id === id);
  if (!found) return errorResponse('Celebration not found', 404);
  if (found.addedBy !== userId)
    return errorResponse('You can only delete celebrations you added', 403);
  await writeCelebrations(celebrations.filter((c) => c.id !== id));
  return successResponse({ success: true, message: 'Celebration deleted' });
}
