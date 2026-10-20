import { CIRCLE_HEADER } from '@family-trivia/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../test/serverData';
import { TimelineProvider, useTimeline } from './TimelineContext';

const Shown: React.FC = () => {
  const { timelineData, error } = useTimeline();
  return <p>{error ? 'failed' : `${timelineData.facts.length} answers`}</p>;
};

const page = (circle: string | null) => ({
  timelineData: {
    facts: [
      {
        userId: `${circle}-bob`,
        username: 'Bob',
        groupId: 'g1',
        question: 'Best road trip?',
        answer: 'The coast',
        fact: 'The coast, noted.',
        timestamp: '2026-10-20T12:00:00.000Z',
      },
    ],
    trivia: [],
  },
  familySides: {},
  pagination: {
    hasMoreFacts: false,
    hasMoreTrivia: false,
    nextFactCursor: null,
    nextTriviaCursor: null,
  },
  success: true,
});

describe("Home's timeline", () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("is the circle's own", async () => {
    const fetch = fakeApi({ 'GET /timeline-data': (circle) => page(circle) });
    openTabIn('crew');
    const view = renderWithServerData(
      <TimelineProvider>
        <Shown />
      </TimelineProvider>,
    );
    await vi.waitFor(() => expect(view.container.textContent).toBe('1 answers'));
    const headers = fetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.[CIRCLE_HEADER]).toBe('crew');
    view.unmount();
  });

  test('a timeline that never came says so, instead of showing an empty one', async () => {
    const fetch = fakeApi({});
    fetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: false, error: 'Failed to retrieve timeline data' }), {
          status: 500,
        }),
    );
    openTabIn('crew');
    const view = renderWithServerData(
      <TimelineProvider>
        <Shown />
      </TimelineProvider>,
    );
    await vi.waitFor(() => expect(view.container.textContent).toBe('failed'));
    view.unmount();
  });
});
