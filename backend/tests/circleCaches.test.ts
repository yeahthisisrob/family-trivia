vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { getFactHistory } from '../services/factHistoryService';
import { inCircle } from '../services/scope';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const entry = (answer: string) => ({
  date: '2026-10-01',
  question: 'Favorite food?',
  answer,
  fact: '',
  answered: true,
  skipped: false,
  timestamp: '2026-10-01T12:00:00Z',
  questionType: 'shared',
});

// One request can read two circles (Your world, a joined circle), and the
// same id can be a different person in each.
describe('per-request caches keep circles apart', () => {
  beforeEach(() => {
    resetS3Mock();
    seedRaw('facts/answers/alice.json', [entry('Pizza')]);
    seedRaw('circles/crew/facts/answers/alice.json', [entry('Tacos')]);
  });

  it("never hands one circle another's answers for the same id", async () => {
    const home = await inCircle({ circleId: 'home', root: true }, () => getFactHistory('alice'));
    const crew = await inCircle({ circleId: 'crew', root: false }, () => getFactHistory('alice'));
    expect(home.map((e) => e.answer)).toEqual(['Pizza']);
    expect(crew.map((e) => e.answer)).toEqual(['Tacos']);
  });
});
