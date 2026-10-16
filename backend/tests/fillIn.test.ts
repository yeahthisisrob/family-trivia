vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/bedrock', () => ({ generateFunFact: async () => 'A fun fact.' }));

import { type FactAnswerEntry, fillInView } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getFillIn, putFillIn } from '../features/fill-in/handlers';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const entry = (
  date: string,
  answer: string,
  extra: Partial<FactAnswerEntry> = {},
): FactAnswerEntry => ({
  date,
  question: `Q ${date}`,
  answer,
  fact: '',
  answered: true,
  skipped: false,
  timestamp: `${date}T12:00:00.000Z`,
  questionType: 'shared',
  ...extra,
});

const long = 'the birds at the feeder every single morning with coffee';

describe('fillInView', () => {
  const qs = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map((date) => ({
    key: `shared:${date}`,
    questionType: 'shared' as const,
    date,
    question: `Q ${date}`,
  }));
  const answers = new Map<string, FactAnswerEntry[]>([
    [
      'carol',
      [
        entry('2026-01-01', 'birds'),
        entry('2026-01-02', long),
        entry('2026-01-03', '[Skipped]', { skipped: true }),
      ],
    ],
    ['bob', qs.map((q) => entry(q.date, long))],
    ['erin', qs.map((q) => entry(q.date, long))],
  ]);
  const v = fillInView('carol', qs, answers);
  const state = (d: string) => v.items.find((i) => i.date === d)?.state;

  test('names each question missing, skipped, brief or full', () => {
    expect([
      state('2026-01-01'),
      state('2026-01-02'),
      state('2026-01-03'),
      state('2026-01-04'),
    ]).toEqual(['brief', 'full', 'skipped', 'missing']);
  });

  test('suggests the missed ones first, then the brief ones; never the full ones', () => {
    expect(v.suggested[0]).not.toBe('shared:2026-01-01');
    expect(v.suggested).toContain('shared:2026-01-01');
    expect(v.suggested).not.toContain('shared:2026-01-02');
  });

  test('compares how full the answers run', () => {
    expect(v.summary.answered).toBe(2);
    expect(v.summary.depth).toBe('shorter');
  });
});

describe('PUT /fill-in', () => {
  beforeEach(() => {
    resetS3Mock();
    invalidateFactHistoryCache();
    seedRaw('facts/daily/shared/2026-01-01.json', { question: 'Q 2026-01-01' });
    seedRaw('facts/answers/carol.json', [entry('2026-01-01', 'birds')]);
    seedRaw('config/member-activation.json', { carol: true });
  });

  const put = (body: unknown) =>
    putFillIn({ body: JSON.stringify(body) } as APIGatewayProxyEvent, 'carol');

  test('adding to an answer keeps what it said and when it was first written', async () => {
    expect((await put({ key: 'shared:2026-01-01', answer: long })).statusCode).toBe(200);
    const [saved] = getStored<FactAnswerEntry[]>('facts/answers/carol.json')!;
    expect(saved!.answer).toBe(long);
    expect(saved!.timestamp).toBe('2026-01-01T12:00:00.000Z');
    expect(saved!.earlier).toEqual([{ answer: 'birds', fact: '', at: '2026-01-01T12:00:00.000Z' }]);
    expect(saved!.editedAt).toBeDefined();
  });

  test('rejects empty answers and unknown questions', async () => {
    expect((await put({ key: 'shared:2026-01-01', answer: '  ' })).statusCode).toBe(400);
    expect((await put({ key: 'shared:1999-01-01', answer: 'x' })).statusCode).toBe(404);
  });

  test('GET lists the caller’s questions', async () => {
    const r = JSON.parse((await getFillIn({} as APIGatewayProxyEvent, 'carol')).body).data;
    expect(r.items[0].state).toBe('full');
  });
});
