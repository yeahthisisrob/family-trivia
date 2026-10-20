vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { sinceLastVisit } from '../features/since/service';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const answer = (timestamp: string) => ({
  date: timestamp.slice(0, 10),
  question: 'Q',
  answer: 'A',
  fact: '',
  answered: true,
  skipped: false,
  timestamp,
  questionType: 'shared',
});

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
});

describe('since you were here', () => {
  test('back after days away: who shared since, once; a quick return says nothing', async () => {
    seedRaw('seen/alice.json', { at: '2026-10-10T12:00:00.000Z' });
    seedRaw('facts/answers/bob.json', [answer('2026-10-12T12:00:00.000Z')]);
    seedRaw('facts/answers/carol.json', [answer('2026-10-01T12:00:00.000Z')]);
    const now = new Date('2026-10-14T12:00:00.000Z');
    expect(await sinceLastVisit('alice', now)).toMatchObject({
      since: '2026-10-10T12:00:00.000Z',
      answeredBy: ['bob'],
    });
    // An hour later: nothing to say.
    expect((await sinceLastVisit('alice', new Date('2026-10-14T13:00:00.000Z'))).since).toBeNull();
  });

  test('a first visit has nothing to catch up on', async () => {
    expect((await sinceLastVisit('dee')).since).toBeNull();
  });
});
