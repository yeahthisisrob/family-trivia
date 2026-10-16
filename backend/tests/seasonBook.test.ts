vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/media', () => ({
  downloadUrl: async (key: string) => `https://example.test/${key}`,
}));
const ai = vi.hoisted(() => ({ plan: '', intro: '', calls: 0, prompt: '' }));
vi.mock('../services/bedrock/core/bedrockClient', () => ({
  invokeBedrockPrompt: async (prompt: string) => {
    ai.calls++;
    ai.prompt = prompt;
    return {};
  },
}));
vi.mock('../services/bedrock/core/responseParser', () => ({
  collectResponseBody: async () => Buffer.from(''),
}));
vi.mock('../services/bedrock/core/textExtractor', () => ({
  // The plan asks for chapters; each chapter asks for its opening.
  extractTextContent: () => (ai.prompt.includes('<chapters>') ? ai.plan : ai.intro),
}));

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
  ai.plan = `<foreword>
We kept coming back to the beach — and to pie.
</foreword>
<chapters>
${JSON.stringify([
  { title: 'Around the table', days: [1, 1, 99] },
  { title: '', days: [0] },
])}
</chapters>`;
  // Straight quotes in the prose: nothing to escape, nothing breaks.
  ai.intro = '<intro>\nPie came up first, "always pie".\n\nThen the beach.\n</intro>';
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

/** Every step of the writing, until no chapter is left. */
async function writeAll(fresh = false) {
  let r = await post(makeBookWriting, { season: 1, tone: 'warm', fresh });
  while (r.data.left > 0) r = await post(makeBookWriting, { season: 1, tone: 'warm' });
  return r;
}

test('written in steps: the plan, then each chapter’s opening, all kept and cleaned', async () => {
  const planned = await post(makeBookWriting, { season: 1, tone: 'warm' });
  expect(planned.data.writing.foreword).toBe('We kept coming back to the beach, and to pie.');
  // A nameless chapter is dropped; its day joins its neighbour, and nothing is lost.
  expect(planned.data.writing.plan).toEqual([
    {
      title: 'Around the table',
      pages: ['2024-02-03|Comfort food?', '2024-01-02|Happy place?'],
      intro: null,
    },
  ]);
  expect(planned.data.left).toBe(1);
  const done = await post(makeBookWriting, { season: 1, tone: 'warm' });
  expect(done.data).toMatchObject({ left: 0, chapters: 1 });
  expect(done.data.writing.plan[0].intro).toBe(
    'Pie came up first, "always pie".\n\nThen the beach.',
  );
  // Once written, asking again costs nothing; fresh starts over.
  await post(makeBookWriting, { season: 1, tone: 'warm' });
  expect(ai.calls).toBe(2);
  await writeAll(true);
  expect(ai.calls).toBe(4);
});

test('the book is made once and kept until something changes', async () => {
  expect((await post(makeSeasonBook, { season: 1, tone: 'warm' })).status).toBe(409);
  await post(makeBookWriting, { season: 1, tone: 'warm' });
  // Planned but not every chapter written: still not a book.
  expect((await post(makeSeasonBook, { season: 1, tone: 'warm' })).status).toBe(409);
  await writeAll();

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
  await writeAll();
  await post(makeSeasonBook, { season: 1, tone: 'warm' });
  await writeAll(true);
  await post(makeSeasonBook, { season: 1, tone: 'warm' });
  await post(makeSeasonBook, { season: 1, tone: 'plain' });

  const pdfs = listStored('books/season-1/').filter((k) => k.endsWith('.pdf'));
  expect(pdfs).toHaveLength(3);
  // Each book beside what it was made from.
  for (const pdf of pdfs) {
    const kept = getStored<{ input: { layout: number; review: unknown } }>(
      pdf.replace(/\.pdf$/, '.input.json'),
    );
    expect(kept?.input.layout).toBe(3);
    expect(kept?.input.review).toBeTruthy();
  }
  // The writing that was replaced, and every AI call word for word.
  const history = listStored('books/season-1/history/');
  expect(history.filter((k) => k.endsWith('.writing.json'))).toHaveLength(1);
  expect(history.filter((k) => k.endsWith('.ai.json'))).toHaveLength(4);
  const call = getStored<{ prompt: string; response: string }>(
    history.find((k) => k.endsWith('-plan.ai.json')) ?? '',
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
