/**
 * Filling in (shared/src/fill-in.ts): the questions someone can go back to,
 * from their own profile. Adding to an answer keeps what it said before and
 * keeps its first timestamp, so its comments and reactions stay with it.
 */
import {
  type FactAnswerEntry,
  type FillInQuestion,
  fillInView,
  keyOf,
} from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { S3_PATHS } from '../../constants';
import { generateFunFact } from '../../services/bedrock';
import {
  appendFactAnswer,
  getAllFactHistories,
  getFactHistory,
  invalidateFactHistoryCache,
} from '../../services/factHistoryService';
import { loadJoined } from '../../services/family/joined';
import { logger } from '../../services/logger';
import { getJson, listObjects, putJson } from '../../services/s3';

const MAX_ANSWER = 2000;

async function questions(): Promise<FillInQuestion[]> {
  const [basic, sharedKeys] = await Promise.all([
    getJson<{ questions?: string[] }>(S3_PATHS.BASIC_QUESTIONS_CONFIG),
    listObjects(S3_PATHS.SHARED_QUESTIONS_DIR),
  ]);
  const shared = await Promise.all(
    sharedKeys
      .filter((k) => /\d{4}-\d{2}-\d{2}\.json$/.test(k))
      .map(async (k) => {
        const date = k.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1] ?? '';
        const q = await getJson<{ question?: string }>(k);
        return q?.question
          ? ({ key: `shared:${date}`, questionType: 'shared', date, question: q.question } as const)
          : null;
      }),
  );
  return [
    ...shared.filter((q) => q !== null).sort((a, b) => b.date.localeCompare(a.date)),
    ...(basic?.questions ?? []).map(
      (question, i) =>
        ({ key: `basic:${i}`, questionType: 'basic', questionIndex: i, question }) as const,
    ),
  ];
}

/** GET /fill-in: the caller's questions to go back to, and how full their answers run. */
export async function getFillIn(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const [qs, all, { joined }] = await Promise.all([
    questions(),
    getAllFactHistories(),
    loadJoined(),
  ]);
  // Compare with the family as the family sees it: people who have joined.
  const answers = new Map([...all].filter(([id]) => id === userId || joined.has(id)));
  return successResponse(fillInView(userId, qs, answers));
}

/** PUT /fill-in {key, answer}: answer a question they missed or skipped, or add to one. */
export async function putFillIn(
  e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  let body: { key?: unknown; answer?: unknown };
  try {
    body = JSON.parse(e.body ?? '{}');
  } catch {
    return errorResponse('Body must be JSON', 400);
  }
  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
  if (!answer) return errorResponse('Write an answer first', 400);
  if (answer.length > MAX_ANSWER) return errorResponse('That answer is too long to save', 400);

  const q = (await questions()).find((x) => x.key === body.key);
  if (!q) return errorResponse('That question is not in the family’s questions', 404);

  const fact = await generateFunFact(userId, q.question, answer).catch(
    () => 'Thanks for adding to the family’s story.',
  );
  const now = new Date().toISOString();
  const entries = await getFactHistory(userId);
  // Only an answer given here: one from another circle stays as it was there.
  const at = entries.findIndex(
    (x) => !x.from && keyOf(x) === q.key && x.answered && !x.skipped && x.answer,
  );

  const was = at >= 0 ? entries[at] : undefined;
  if (was) {
    entries[at] = {
      ...was,
      answer,
      fact,
      editedAt: now,
      earlier: [
        ...(was.earlier ?? []),
        { answer: was.answer, fact: was.fact, at: was.editedAt ?? was.timestamp },
      ],
    };
    await putJson(S3_PATHS.FACT_ANSWER_HISTORY(userId), entries);
    invalidateFactHistoryCache(userId);
    logger.info('Added to an answer', { userId, key: q.key });
  } else {
    const entry: FactAnswerEntry = {
      date: q.date ?? now.slice(0, 10),
      question: q.question,
      answer,
      fact,
      answered: true,
      skipped: false,
      timestamp: now,
      questionType: q.questionType,
      questionIndex: q.questionIndex,
    };
    await appendFactAnswer(userId, entry);
    invalidateFactHistoryCache(userId);
    logger.info('Filled in a question', { userId, key: q.key });
  }
  return successResponse({ key: q.key, fact });
}
