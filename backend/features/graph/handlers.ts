/**
 * GET /graph: everything the family graph draws. People with how active they
 * are, the ties between them, households, and who answered alike (with the
 * answers as evidence). Computed from the family's own data on each request;
 * nothing is sent anywhere.
 */
import { type Answer, likenesses } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse } from '../../config';
import { loadJoined } from '../../services/family/joined';
import { getJson } from '../../services/s3';

interface FactEntry {
  date?: string;
  question?: string;
  answer?: string;
  answered?: boolean;
  skipped?: boolean;
  questionType?: string;
}

export async function getGraph(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { visible: family } = await loadJoined();
  const ids = Object.keys(family.people);
  const [facts, trivia] = await Promise.all([
    Promise.all(ids.map((id) => getJson<FactEntry[]>(`facts/answers/${id}.json`))),
    Promise.all(
      ids.map((id) =>
        getJson<{ correct?: boolean; timestamp?: string }[]>(`answers/history/${id}.json`),
      ),
    ),
  ]);

  const answers: Answer[] = [];
  const activity: Record<
    string,
    { facts: number; trivia: number; correct: number; since: string | null }
  > = {};
  ids.forEach((id, i) => {
    const mine = (facts[i] ?? []).filter(
      (f) => f.answer?.trim() && f.answered !== false && !f.skipped,
    );
    // Birthdays and other basic questions aren't opinions: leave them out of likeness.
    for (const f of mine) {
      if (f.question && f.questionType !== 'basic')
        answers.push({ personId: id, question: f.question, answer: f.answer as string });
    }
    const history = Array.isArray(trivia[i])
      ? (trivia[i] as { correct?: boolean; timestamp?: string }[])
      : [];
    const dates = [...mine.map((f) => f.date), ...history.map((h) => h.timestamp?.slice(0, 10))]
      .filter((d): d is string => !!d)
      .sort();
    activity[id] = {
      facts: mine.length,
      trivia: history.length,
      correct: history.filter((h) => h.correct).length,
      since: dates[0] ?? null,
    };
  });

  return successResponse({
    people: Object.values(family.people).map((p) => ({
      id: p.id,
      name: p.name,
      participation: p.participation,
      remembered: !!p.memorial,
      died: p.memorial?.died ?? null,
      activity: activity[p.id],
    })),
    ties: family.ties,
    households: Object.values(family.households),
    likenesses: likenesses(answers),
  });
}
