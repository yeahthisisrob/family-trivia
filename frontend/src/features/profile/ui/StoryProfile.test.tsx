import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { exampleFamily, exampleGraph } from '../../../test/fixtures/exampleFamily';
import { fakeApi, later, openTabIn, renderWithServerData } from '../../../test/serverData';
import { KNOWLEDGE } from '../../family-home/ui/familyHomeMocks';
import { JO } from './profileMocks';
import { StoryProfile } from './StoryProfile';

const saidIn = (circle: string | null) => ({
  ...JO,
  words: [
    { id: 'jo_1', question: 'Happy place?', answer: `The ${circle} lake`, date: '2026-10-01' },
  ],
  last: ['jo_1'],
  loved: [],
  mentions: [],
  loves: [],
});

const triviaIn = (circle: string | null) => ({
  profile: {},
  history: [],
  streak: 0,
  facts: [],
  categorySelections: [],
  difficultyStats: { easy: 0, normal: 0, hard: 0, total: 0 },
  categoryBonusStats: { timesBonusEarned: 0, totalBonusPoints: 0 },
  totalScore: circle === 'crew' ? 17 : 29,
  scoringHistory: [],
  lastUpdated: '2026-10-20T12:00:00.000Z',
});

function profileApi(home: Promise<unknown>) {
  return fakeApi({
    'GET /family': () => ({ family: exampleFamily, photoUrls: {} }),
    'GET /graph': () => exampleGraph,
    'GET /family/knowledge': () => ({ ...KNOWLEDGE, people: {} }),
    'GET /family/person-story': (circle) => (circle === 'crew' ? saidIn(circle) : home),
    'GET /user-profile': (circle) => triviaIn(circle),
    'GET /member-summary': (circle) => ({
      userId: 'jo',
      mode: 'regular',
      summary: `Jo, as ${circle} sees them.`,
      lastUpdated: '2026-10-20T12:00:00.000Z',
    }),
  });
}

const profile = () => <StoryProfile userId="jo" meId="carol" onBack={() => undefined} />;

describe('a profile is cached per circle', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("after a switch, nothing from the other circle's story or points shows", async () => {
    const home = later<unknown>();
    profileApi(home.promise);

    openTabIn('crew');
    const crew = renderWithServerData(profile());
    await vi.waitFor(() => expect(crew.container.textContent).toContain('The crew lake'));
    await vi.waitFor(() => expect(crew.container.textContent).toContain('17'));
    crew.unmount();

    // Same page, same cache: the tab now asks in its other circle.
    openTabIn('home');
    const again = renderWithServerData(profile(), crew.client);
    await new Promise((r) => setTimeout(r, 20));
    expect(again.container.textContent).not.toContain('The crew lake');

    home.settle(saidIn('home'));
    await vi.waitFor(() => expect(again.container.textContent).toContain('The home lake'));
    await vi.waitFor(() => expect(again.container.textContent).toContain('29'));
    expect(again.container.textContent).not.toContain('crew');
    again.unmount();
  });
});
