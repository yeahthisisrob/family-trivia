vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/media', () => ({
  readUrl: async (k: string) => `https://signed.example.com/${k}`,
}));

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
