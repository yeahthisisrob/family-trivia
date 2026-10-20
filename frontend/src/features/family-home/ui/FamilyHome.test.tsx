import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { exampleFamily, exampleGraph } from '../../../test/fixtures/exampleFamily';
import { fakeApi, later, openTabIn, renderWithServerData } from '../../../test/serverData';
import { FamilyHome } from './FamilyHome';
import { KNOWLEDGE } from './familyHomeMocks';

const storyIn = (circle: string | null) => ({
  markdown: `The ${circle} story, told from everyone's answers.`,
  generatedAt: '2026-10-01T12:00:00Z',
  stats: { people: 11, playing: 8, households: 2, answers: 1284, since: '2025-06-01' },
});

/** What shows, in lower case (theme names are capitalized). */
const shown = (el: HTMLElement) => el.textContent?.toLowerCase() ?? '';
const fromCrew = /crew (story|picnics)/;

const themeIn = (circle: string | null) => ({
  ...KNOWLEDGE,
  themes: [{ name: `${circle} picnics`, kind: 'activity', people: ['carol', 'jo'], quotes: [] }],
});

function usApi(home: { story: Promise<unknown>; knowledge: Promise<unknown> }) {
  return fakeApi({
    'GET /family': () => ({ family: exampleFamily, photoUrls: {} }),
    'GET /graph': () => exampleGraph,
    'GET /family/story': (circle) => (circle === 'crew' ? storyIn(circle) : home.story),
    'GET /family/knowledge': (circle) => (circle === 'crew' ? themeIn(circle) : home.knowledge),
    'GET /member-summary': () => ({
      userId: 'jo',
      mode: 'regular',
      summary: 'Happiest outside.',
      lastUpdated: '2026-10-20T12:00:00.000Z',
    }),
  });
}

describe('Us is cached per circle', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("after a switch, the other circle's story and themes never show", async () => {
    const story = later<unknown>();
    const knowledge = later<unknown>();
    usApi({ story: story.promise, knowledge: knowledge.promise });

    openTabIn('crew');
    const crew = renderWithServerData(<FamilyHome meId="carol" />);
    await vi.waitFor(() => expect(shown(crew.container)).toContain('the crew story'));
    await vi.waitFor(() => expect(shown(crew.container)).toContain('crew picnics'));
    crew.unmount();

    openTabIn('home');
    const again = renderWithServerData(<FamilyHome meId="carol" />, crew.client);
    await vi.waitFor(() => expect(again.container.textContent).toContain('Carol'));
    expect(shown(again.container)).not.toMatch(fromCrew);

    story.settle(storyIn('home'));
    knowledge.settle(themeIn('home'));
    await vi.waitFor(() => expect(shown(again.container)).toContain('the home story'));
    await vi.waitFor(() => expect(shown(again.container)).toContain('home picnics'));
    expect(shown(again.container)).not.toMatch(fromCrew);
    again.unmount();
  });
});
