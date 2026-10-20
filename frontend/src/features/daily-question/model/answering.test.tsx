import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { usePersonStory } from '../../../entities/family';
import { useTriviaProfile } from '../../../entities/person';
import { useTimelineFeed } from '../../../entities/timeline';
import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { useFactSummary } from '../../fact-summary/model/factSummary';
import { useFactGrid } from '../../who-has-played/model/grids';
import { useEditAnswer, useFactHistory } from './dailyQuestion';
import { useDailyFactFlow } from './useDailyFactFlow';

const QUESTION = 'What was the best road trip?';
const WEEK = '2026-10-11';

/** Today's question, and the cards below it on Home that show who answered. */
const Home: React.FC = () => {
  const [flow, actions] = useDailyFactFlow({ userId: 'alice' });
  const grid = useFactGrid('alice').data;
  const summary = useFactSummary(WEEK, true, true).data;
  const timeline = useTimelineFeed('all').data;
  const profile = useTriviaProfile('alice').data;
  const story = usePersonStory('alice').data;
  return (
    <>
      <p id="step">{flow.step}</p>
      <p id="fact">{flow.factResponse}</p>
      <p id="played">{grid?.rows[0]?.answered}</p>
      <p id="answers">{summary?.totalResponses}</p>
      <p id="timeline">{timeline?.facts.length}</p>
      <p id="profile">{profile?.facts.length}</p>
      <p id="story">{story?.words.length}</p>
      <button type="button" onClick={() => void actions.submit('The coast')}>
        Send
      </button>
    </>
  );
};

const text = (container: HTMLElement, id: string) => container.querySelector(`#${id}`)?.textContent;

const said = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `alice_${i}`,
    question: QUESTION,
    answer: 'The coast',
    date: '2026-10-20',
  }));

/** A made-up API where alice's answer shows everywhere it's counted. */
function homeApi() {
  let answered = 0;
  return fakeApi({
    'GET /user-profile': () => ({
      profile: {},
      history: [],
      streak: 0,
      facts: said(answered).map((w) => ({ ...w, fact: '', timestamp: '2026-10-20T12:00:00Z' })),
      categorySelections: [],
      difficultyStats: { easy: 0, normal: 0, hard: 0, total: 0 },
      categoryBonusStats: { timesBonusEarned: 0, totalBonusPoints: 0 },
      totalScore: 0,
      scoringHistory: [],
      lastUpdated: '2026-10-20T12:00:00Z',
    }),
    'GET /family/person-story': () => ({
      personId: 'alice',
      words: said(answered),
      last: [],
      loved: [],
      trivia: { played: 0, right: 0 },
      span: { first: null, last: null },
      mentions: [],
      replies: [],
      loves: [],
    }),
    'GET /daily-fact': () => ({
      question: QUESTION,
      answered: answered > 0,
      questionType: 'shared',
    }),
    'GET /user-fact-history': () => ({
      history: said(answered).map((w) => ({
        question: w.question,
        answer: w.answer,
        date: w.date,
        questionType: 'shared',
        answered: true,
        timestamp: '2026-10-20T12:00:00Z',
      })),
      basicQuestions: [],
      basicQuestionsTotal: 0,
      allSharedQuestions: [],
    }),
    'POST /submit-historical-fact': () => {
      answered += 1;
      return { success: true, fact: 'Road trips stay with a family for years.' };
    },
    'POST /submit-daily-fact': () => {
      answered += 1;
      return { success: true, fact: 'Road trips stay with a family for years.' };
    },
    'GET /fact-grid': (circle) => ({
      rows: [{ userId: `alice in ${circle}`, cells: [], answered, seasonGaps: 0 }],
      totalColumns: 1,
      seasonMarkers: [],
      seasonStartCol: 0,
      todayColumn: 0,
    }),
    'GET /daily-fact-summary': () => ({
      summary: 'A week of road trips.',
      lastUpdated: '2026-10-18T12:00:00.000Z',
      totalResponses: answered,
      sideAResponses: 0,
      sideBResponses: 0,
      factType: 'shared',
    }),
    'GET /timeline-data': () => ({
      timelineData: {
        facts: Array.from({ length: answered }, () => ({
          userId: 'alice',
          username: 'Alice',
          groupId: 'g1',
          question: QUESTION,
          answer: 'The coast',
          fact: 'Road trips stay with a family for years.',
          timestamp: '2026-10-20T12:00:00.000Z',
        })),
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
    }),
  });
}

const asked = (fetch: ReturnType<typeof fakeApi>, path: string) =>
  fetch.mock.calls.filter(([url]) => new URL(url).pathname === path).length;

describe("answering today's question", () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test('shows its fact at once, then who has played, the week, the timeline and the profile ask again', async () => {
    const fetch = homeApi();
    openTabIn('home');
    const view = renderWithServerData(<Home />);
    await vi.waitFor(() => expect(text(view.container, 'step')).toBe('question'));
    await vi.waitFor(() => expect(text(view.container, 'played')).toBe('0'));
    expect(text(view.container, 'answers')).toBe('0');
    expect(text(view.container, 'timeline')).toBe('0');
    await vi.waitFor(() => expect(text(view.container, 'profile')).toBe('0'));
    await vi.waitFor(() => expect(text(view.container, 'story')).toBe('0'));
    const gridAsks = asked(fetch, '/fact-grid');

    act(() => view.container.querySelector('button')?.click());
    await vi.waitFor(() => expect(text(view.container, 'step')).toBe('response'));
    expect(text(view.container, 'fact')).toContain('Road trips');

    await vi.waitFor(() => expect(text(view.container, 'played')).toBe('1'));
    expect(asked(fetch, '/fact-grid')).toBe(gridAsks + 1);
    await vi.waitFor(() => expect(text(view.container, 'answers')).toBe('1'));
    await vi.waitFor(() => expect(text(view.container, 'timeline')).toBe('1'));
    await vi.waitFor(() => expect(text(view.container, 'profile')).toBe('1'));
    await vi.waitFor(() => expect(text(view.container, 'story')).toBe('1'));
    view.unmount();
  });

  test('a past answer saved from the profile shows in its history, trivia and story', async () => {
    homeApi();
    let save: () => Promise<unknown> = async () => undefined;
    const Profile: React.FC = () => {
      const pastAnswer = useEditAnswer();
      save = () =>
        pastAnswer.mutateAsync({
          userId: 'alice',
          question: QUESTION,
          answer: 'The coast',
          date: '2026-10-19',
          questionType: 'shared',
        });
      return (
        <>
          <p id="history">{useFactHistory('alice', true).data?.history.length}</p>
          <p id="profile">{useTriviaProfile('alice').data?.facts.length}</p>
          <p id="story">{usePersonStory('alice').data?.words.length}</p>
        </>
      );
    };
    openTabIn('home');
    const view = renderWithServerData(<Profile />);
    await vi.waitFor(() => expect(text(view.container, 'history')).toBe('0'));
    await vi.waitFor(() => expect(text(view.container, 'story')).toBe('0'));

    await act(async () => {
      await save();
    });
    await vi.waitFor(() => expect(text(view.container, 'history')).toBe('1'));
    expect(text(view.container, 'profile')).toBe('1');
    expect(text(view.container, 'story')).toBe('1');
    view.unmount();
  });

  test("who has played is cached per circle: another circle's grid never shows", async () => {
    homeApi();
    const Grid = () => <p id="who">{useFactGrid('alice').data?.rows[0]?.userId}</p>;
    openTabIn('crew');
    const crewGrid = renderWithServerData(<Grid />);
    await vi.waitFor(() => expect(text(crewGrid.container, 'who')).toBe('alice in crew'));
    crewGrid.unmount();

    openTabIn('home');
    const homeGrid = renderWithServerData(<Grid />, crewGrid.client);
    expect(text(homeGrid.container, 'who')).not.toBe('alice in crew');
    await vi.waitFor(() => expect(text(homeGrid.container, 'who')).toBe('alice in home'));
    homeGrid.unmount();
  });
});
