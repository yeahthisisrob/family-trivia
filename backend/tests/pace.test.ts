vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { getEasternDateString, type HistoryEntry, playPeriod } from '@family-trivia/shared';
import {
  calculateCatchupStatus,
  checkPlayEligibility,
  invalidatePlayerStateCache,
} from '../services/playerStateService';
import { currentPlayDay, invalidateSeasonsCache } from '../services/seasonService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const today = getEasternDateString(new Date());
const monday = playPeriod(today, 'weekly');
const at = (day: string, n = 0) =>
  new Date(Date.parse(`${day}T16:00:00.000Z`) + n * 86_400_000).toISOString();
const play = (timestamp: string): HistoryEntry => ({
  question: {
    question: 'Q?',
    choices: ['A', 'B'],
    answer: 'A',
    difficulty: 'normal',
    category: 'T',
  },
  selectedAnswer: 'A',
  correct: true,
  timestamp,
  pointsEarned: 1,
});

function weekly(history: HistoryEntry[]) {
  resetS3Mock();
  invalidateSeasonsCache();
  invalidatePlayerStateCache();
  seedRaw('config/seasons.json', {
    currentSeasonNumber: 1,
    seasons: [
      {
        seasonNumber: 1,
        name: 'S1',
        status: 'active',
        startDate: '2026-01-01',
        endDate: null,
        message: null,
        pace: 'weekly',
        perWeek: 3,
      },
    ],
  });
  seedRaw('answers/history/alice.json', history);
}

describe('a weekly season', () => {
  test("questions are the week's: keyed by Monday", async () => {
    weekly([]);
    expect(await currentPlayDay()).toBe(monday);
  });

  test("the week's handful, then wait for Monday", async () => {
    weekly([play(at(monday)), play(at(monday))]);
    expect((await checkPlayEligibility('alice', 'regular')).canPlay).toBe(true);
    weekly([play(at(monday)), play(at(monday)), play(at(monday))]);
    const done = await checkPlayEligibility('alice', 'regular');
    expect(done).toMatchObject({ canPlay: false, reason: 'daily_limit_reached' });
  });

  test('a week away leaves the week waiting, nothing more', async () => {
    // First played two weeks ago, one question that week, nothing last week.
    weekly([play(at(monday, -14))]);
    const s = await calculateCatchupStatus('alice');
    // Two weeks owed at three a week, one answered.
    expect(s.questionsBehind).toBe(5);
  });
});
