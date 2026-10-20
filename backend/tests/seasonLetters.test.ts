vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/media', () => ({
  readUrl: async (k: string) => `https://signed.example.com/${k}`,
}));

import { getEasternDateString } from '@family-trivia/shared';
import {
  getSeasonStatusResponse,
  invalidateSeasonsCache,
  markLetterSeen,
} from '../services/seasonService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const concluded = (notes?: object, message: string | null = null) => ({
  currentSeasonNumber: null,
  seasons: [
    {
      seasonNumber: 2,
      name: 'Spring',
      status: 'concluded',
      startDate: '2026-03-01',
      endDate: '2026-04-01',
      message,
      notes,
    },
  ],
});

beforeEach(() => {
  resetS3Mock();
  invalidateSeasonsCache();
});

describe('season letters', () => {
  test('between seasons, the end letter shows once per person, with its photo', async () => {
    seedRaw(
      'config/seasons.json',
      concluded({ end: { markdown: 'Thank you!', image: 'media/seasons/a.jpg' } }),
    );
    const first = await getSeasonStatusResponse('alice');
    expect(first.letter).toEqual({
      seasonNumber: 2,
      kind: 'end',
      markdown: 'Thank you!',
      imageUrl: 'https://signed.example.com/media/seasons/a.jpg',
    });
    await markLetterSeen('alice', 2, 'end');
    expect((await getSeasonStatusResponse('alice')).letter).toBeNull();
    expect((await getSeasonStatusResponse('bob')).letter).not.toBeNull();
  });

  test('a letter can carry its own title', async () => {
    seedRaw(
      'config/seasons.json',
      concluded({ end: { title: 'In memory of…', markdown: 'For Grace.' } }),
    );
    expect((await getSeasonStatusResponse('alice')).letter?.title).toBe('In memory of…');
  });

  test('no letter written means nothing pops up', async () => {
    seedRaw('config/seasons.json', concluded());
    expect((await getSeasonStatusResponse('alice')).letter).toBeNull();
  });

  test('an old plain-text message becomes the end letter', async () => {
    seedRaw('config/seasons.json', concluded(undefined, 'Great season, everyone.'));
    expect((await getSeasonStatusResponse('alice')).letter?.markdown).toBe(
      'Great season, everyone.',
    );
  });

  test('marking seen twice keeps one entry', async () => {
    await markLetterSeen('alice', 2, 'end');
    await markLetterSeen('alice', 2, 'end');
    const { getStored } = await import('./helpers/s3Mock');
    expect(getStored<{ letters: string[] }>('seasons/seen/alice.json')?.letters).toEqual(['2:end']);
  });
});

describe('the opening letter, when no one wrote one', () => {
  const today = getEasternDateString();
  const daysAgo = (n: number) =>
    new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  const running = (startDate: string, extra: object = {}, before: object[] = []) => ({
    currentSeasonNumber: 3,
    seasons: [
      ...before,
      {
        seasonNumber: 3,
        name: 'Fall',
        status: 'active',
        startDate,
        endDate: null,
        message: null,
        ...extra,
      },
    ],
  });
  const spring = {
    seasonNumber: 2,
    name: 'Spring',
    status: 'concluded',
    startDate: '2026-03-01',
    endDate: '2026-04-01',
    message: null,
  };
  const said = (date: string, extra: object = {}) => ({
    date,
    question: 'Q?',
    answer: 'A',
    fact: '',
    answered: true,
    skipped: false,
    timestamp: `${date}T12:00:00Z`,
    questionType: 'shared',
    ...extra,
  });

  test('a season that just began opens with what it is, once', async () => {
    seedRaw(
      'config/seasons.json',
      running(today, { pace: 'weekly', play: 'teams', trivia: 'family' }),
    );
    const letter = (await getSeasonStatusResponse('alice')).letter;
    expect(letter).toMatchObject({ seasonNumber: 3, kind: 'start', title: 'Fall begins' });
    expect(letter?.markdown).toContain('the first season for the family');
    expect(letter?.markdown).toContain('**Teams:**');
    expect(letter?.markdown).toContain('5 trivia questions');
    expect(letter?.markdown).toContain('Nothing expires');
    await markLetterSeen('alice', 3, 'start');
    expect((await getSeasonStatusResponse('alice')).letter).toBeNull();
  });

  test('it tells how last season went, from answers given here', async () => {
    seedRaw('config/seasons.json', running(daysAgo(3), {}, [spring]));
    seedRaw('facts/answers/alice.json', [
      said('2026-03-02'),
      said('2026-03-09'),
      said('2026-05-01'),
    ]);
    seedRaw('facts/answers/bob.json', [said('2026-03-05'), said('2026-03-06', { skipped: true })]);
    const md = (await getSeasonStatusResponse('alice')).letter?.markdown ?? '';
    expect(md).toContain('Welcome back. Fall starts now.');
    expect(md).toContain('In Spring, 2 people shared 3 answers');
  });

  test('a season under way for weeks says nothing new', async () => {
    seedRaw('config/seasons.json', running(daysAgo(30)));
    expect((await getSeasonStatusResponse('alice')).letter).toBeNull();
  });

  test("an admin's own start letter wins", async () => {
    seedRaw(
      'config/seasons.json',
      running(today, { notes: { start: { markdown: 'Our words.' } } }),
    );
    expect((await getSeasonStatusResponse('alice')).letter?.markdown).toBe('Our words.');
  });
});
