vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/media', () => ({
  downloadUrl: async (k: string) => `https://signed.example.com/${k}`,
}));

import type { Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { strFromU8, unzipSync } from 'fflate';
import { archiveOptions, exportArchive, saveExportPermissions } from '../features/archive/handlers';
import { invalidateUserConfigCache } from '../services/users';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const ev = (body?: unknown) =>
  ({ body: body === undefined ? null : JSON.stringify(body) }) as APIGatewayProxyEvent;
const data = (r: { body: string }) => JSON.parse(r.body).data;

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    grace: {
      id: 'grace',
      name: 'Grandma Grace',
      participation: 'not-playing',
      memorial: { died: '2024', dedication: 'Always in the garden.' },
    },
  },
  ties: [{ id: 't1', type: 'parent', parent: 'grace', child: 'alice', kind: 'birth' }],
  households: {},
};

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  seedRaw('config/users.json', {
    users: {
      alice: { group: 'g', color: '#000', isAdmin: true },
      bob: { group: 'g', color: '#111' },
    },
  });
  seedRaw('family/family.json', family);
  seedRaw('facts/answers/grace.json', [
    {
      date: '2024-01-02',
      question: 'What always makes you smile?',
      answer: 'The birds at the feeder',
      answered: true,
    },
    { date: '2024-01-03', question: 'Skipped one', answer: '', skipped: true },
  ]);
  seedRaw('answers/history/grace.json', [
    {
      question: {
        question: 'Capital of France?',
        answer: 'Paris',
        category: 'Geography',
        difficulty: 'easy',
      },
      selectedAnswer: 'Paris',
      correct: true,
      timestamp: '2024-01-02T10:00:00Z',
      pointsEarned: 1,
    },
  ]);
  seedRaw('comments/fact/x.json', {
    contentType: 'fact',
    contentId: 'x',
    comments: [
      { id: 'c1', userId: 'grace', text: 'Love this, "dear"', timestamp: '2024-01-04T00:00:00Z' },
    ],
  });
  seedRaw('reactions/fact/grace_2024-01-03T00:00:00Z.json', {
    byUser: { alice: { reaction: 'hug', at: '2024-01-06T00:00:00Z' } },
  });
  seedRaw('arcade/scores/tetris.json', [{ userId: 'grace', score: 900, date: '2024-01-05' }]);
});

describe('family archive', () => {
  test('admins can always export; others need permission', async () => {
    expect(data(await archiveOptions(ev(), 'alice')).canExport).toBe(true);
    expect(data(await archiveOptions(ev(), 'bob')).canExport).toBe(false);
    expect((await exportArchive(ev({ people: 'all' }), 'bob')).statusCode).toBe(403);
    await saveExportPermissions(ev({ everyone: true, users: {} }), 'alice');
    expect(data(await archiveOptions(ev(), 'bob')).canExport).toBe(true);
  });

  test('a zip with one readable folder per person', async () => {
    const r = await exportArchive(ev({ people: ['grace'] }), 'alice');
    expect(r.statusCode).toBe(200);
    const { url } = data(r);
    const key = url.replace('https://signed.example.com/', '');
    const files = unzipSync(getStored<Uint8Array>(key) as Uint8Array);
    const names = Object.keys(files);
    const root = names[0]?.split('/')[0];
    expect(root).toMatch(/^the-example-family-archive-\d{4}-\d{2}-\d{2}$/);
    const read = (p: string) => strFromU8(files[`${root}/${p}`] as Uint8Array);
    expect(read('people/grandma-grace/facts.md')).toContain('The birds at the feeder');
    expect(read('people/grandma-grace/facts.md')).not.toContain('Skipped one');
    expect(read('people/grandma-grace/profile.md')).toContain('Always in the garden.');
    expect(read('people/grandma-grace/trivia-answers.csv')).toContain('Capital of France?');
    expect(read('people/grandma-grace/comments.md')).toContain('Love this');
    expect(JSON.parse(read('people/grandma-grace/games.json')).arcade[0].score).toBe(900);
    expect(JSON.parse(read('people/grandma-grace/reactions.json')).received).toEqual([
      {
        on: 'fact grace_2024-01-03T00:00:00Z',
        from: 'alice',
        reaction: 'hug',
        at: '2024-01-06T00:00:00Z',
      },
    ]);
    expect(read('README.md')).toContain('1 person');
    expect(names.some((n) => n.includes('/people/alice/'))).toBe(false);
  });

  test('nobody chosen is a clear error', async () => {
    expect((await exportArchive(ev({ people: [] }), 'alice')).statusCode).toBe(400);
  });
});
