vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/media', () => ({
  downloadUrl: async (key: string) => `https://example.test/${key}`,
}));
const ai = vi.hoisted(() => ({ reply: '', calls: 0 }));
vi.mock('../services/bedrock/core/bedrockClient', () => ({
  invokeBedrockPrompt: async () => {
    ai.calls++;
    return {};
  },
}));
vi.mock('../services/bedrock/core/responseParser', () => ({
  collectResponseBody: async () => Buffer.from(''),
}));
vi.mock('../services/bedrock/core/textExtractor', () => ({ extractTextContent: () => ai.reply }));

import type { FactAnswerEntry, Family, SeasonReview } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { curly, seasonBook } from '../features/look-back/book';
import {
  listBookVersions,
  makeBookWriting,
  makeSeasonBook,
} from '../features/look-back/bookHandler';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { invalidateSeasonsCache } from '../services/seasonService';
import { getStored, listStored, resetS3Mock, seedRaw, seedSeasons } from './helpers/s3Mock';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
  },
  ties: [],
  households: {},
};
const said = (date: string, question: string, answer: string): FactAnswerEntry => ({
  date,
  question,
  answer,
  fact: '',
  answered: true,
  skipped: false,
  timestamp: `${date}T13:00:00.000Z`,
  questionType: 'shared',
});
const post = (fn: typeof makeSeasonBook, body: unknown) =>
  fn({ body: JSON.stringify(body) } as APIGatewayProxyEvent).then((r) => ({
    status: r.statusCode,
    data: JSON.parse(r.body).data,
  }));

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  invalidateSeasonsCache();
  ai.calls = 0;
  ai.reply = JSON.stringify({
    foreword: 'We kept coming back to the beach — and to pie.',
    chapters: { '2024-01': 'January was about home.', '1999-01': 'Not a month in this book.' },
  });
  seedRaw('family/family.json', family);
  seedSeasons({
    currentSeasonNumber: null,
    seasons: [
      {
        seasonNumber: 1,
        name: 'Winter',
        status: 'concluded',
        startDate: '2024-01-01',
        endDate: '2024-02-28',
        message: null,
      },
    ],
  });
  seedRaw('facts/answers/alice.json', [
    said('2024-01-02', 'Happy place?', 'The beach'),
    said('2024-02-03', 'Comfort food?', 'Pie'),
  ]);
  seedRaw('facts/answers/bob.json', [said('2024-01-02', 'Happy place?', 'The "garden"')]);
});

test('printers’ quotes', () => {
  expect(curly(`She said "don't" and 'yes'`)).toBe('She said “don’t” and ‘yes’');
});

test('a book: a PDF with an even number of pages, longer with a foreword', async () => {
  const review = {
    season: { number: 1, name: 'Winter', startDate: '2024-01-01', endDate: '2024-02-28' },
    seasons: [],
    numbers: { people: 1, answers: 1, words: 2, trivia: 0, comments: 0, reactions: 0, days: 1 },
    together: [],
    loved: [],
    people: [{ personId: 'alice', answers: 1, words: 2, trivia: 0, right: 0, points: 0 }],
    book: [
      {
        date: '2024-01-02',
        question: 'Happy place?',
        answers: [{ personId: 'alice', answer: 'The beach' }],
      },
    ],
  } satisfies SeasonReview;
  const people = { alice: { id: 'alice', name: 'Alice' } };
  const plain = await seasonBook({ review, familyName: 'F', people, madeOn: new Date() });
  const written = await seasonBook({
    review,
    familyName: 'F',
    people,
    madeOn: new Date(),
    writing: {
      tone: 'warm',
      foreword: 'A long foreword.\n\nTwo paragraphs.',
      chapters: {},
      writtenAt: '',
    },
  });
  expect(plain.pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(plain.pages % 2).toBe(0);
  expect(written.pages).toBeGreaterThan(plain.pages);
});

test('the writing is asked for once per tone, kept, and cleaned', async () => {
  const first = await post(makeBookWriting, { season: 1, tone: 'warm' });
  expect(first.data.writing.foreword).toBe('We kept coming back to the beach, and to pie.');
  expect(Object.keys(first.data.writing.chapters)).toEqual(['2024-01']);
  await post(makeBookWriting, { season: 1, tone: 'warm' });
  expect(ai.calls).toBe(1);
  await post(makeBookWriting, { season: 1, tone: 'warm', fresh: true });
  expect(ai.calls).toBe(2);
  expect(getStored('books/season-1/warm.writing.json')).toBeTruthy();
});

test('the book is made once and kept until something changes', async () => {
  expect((await post(makeSeasonBook, { season: 1, tone: 'warm' })).status).toBe(409);
  await post(makeBookWriting, { season: 1, tone: 'warm' });

  const made = await post(makeSeasonBook, { season: 1, tone: 'warm' });
  expect(made.data).toMatchObject({ made: true, tone: 'warm' });
  expect(made.data.url).toContain('books/season-1/warm/');
  expect((await post(makeSeasonBook, { season: 1, tone: 'warm' })).data.made).toBe(false);

  seedRaw('facts/answers/bob.json', [said('2024-01-02', 'Happy place?', 'The lake')]);
  invalidateFactHistoryCache();
  expect((await post(makeSeasonBook, { season: 1, tone: 'warm' })).data.made).toBe(true);
});

test('just our words needs no writing', async () => {
  const { data } = await post(makeSeasonBook, { season: 1, tone: 'plain' });
  expect(data).toMatchObject({ made: true, tone: 'plain' });
  expect(ai.calls).toBe(0);
});

test('nothing is replaced: every book and every earlier writing is kept', async () => {
  await post(makeBookWriting, { season: 1, tone: 'warm' });
  await post(makeSeasonBook, { season: 1, tone: 'warm' });
  await post(makeBookWriting, { season: 1, tone: 'warm', fresh: true });
  await post(makeSeasonBook, { season: 1, tone: 'warm' });
  await post(makeSeasonBook, { season: 1, tone: 'plain' });

  const pdfs = listStored('books/season-1/').filter((k) => k.endsWith('.pdf'));
  expect(pdfs).toHaveLength(3);
  // Each book beside what it was made from.
  for (const pdf of pdfs) {
    const input = getStored<{ layout: number; review: unknown; tone: string }>(
      pdf.replace(/\.pdf$/, '.input.json'),
    );
    expect(input?.layout).toBe(1);
    expect(input?.review).toBeTruthy();
  }
  // The writing that was replaced, and both AI calls word for word.
  const history = listStored('books/season-1/history/');
  expect(history.filter((k) => k.endsWith('.writing.json'))).toHaveLength(1);
  expect(history.filter((k) => k.endsWith('.ai.json'))).toHaveLength(2);
  const call = getStored<{ prompt: string; response: string }>(
    history.find((k) => k.endsWith('.ai.json')) ?? '',
  );
  expect(call?.prompt).toContain('Happy place?');
  expect(call?.response).toContain('foreword');

  const r = await listBookVersions({
    queryStringParameters: { season: '1' },
  } as unknown as APIGatewayProxyEvent);
  const { versions } = JSON.parse(r.body).data;
  expect(versions.map((v: { tone: string }) => v.tone)).toEqual(['plain', 'warm', 'warm']);
  expect(versions[1].writtenAt).not.toBe(versions[2].writtenAt);
});
