import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import Leaderboard from './Leaderboard';

const entry = (userId: string, score: number, questionsAnswered: number) => ({
  leaderboardEntry: { userId, score, streak: 2, questionsAnswered, accuracy: 70 },
  history: [],
  facts: [],
});

const seasons = [
  {
    seasonNumber: 1,
    name: 'Spring',
    status: 'concluded',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
  },
  { seasonNumber: 2, name: 'Summer', status: 'active', startDate: '2026-04-01', endDate: null },
];

const group = (groupId: string, totalScore: number, memberCount: number, topScorer: string) => ({
  groupId,
  totalScore,
  memberCount,
  topScorer,
  topScore: totalScore,
  averageScore: totalScore / memberCount,
});

/** The results as the API sends them: grace is remembered, bob is taking a break. */
const results = (season: string | null) => ({
  users: {
    alice: entry('alice', season === '1' ? 8 : 14, 12),
    carol: entry('carol', 11, 12),
    bob: entry('bob', 6, 7),
    grace: entry('grace', 4, 5),
  },
  groups: {
    smiths: group('smiths', 20, 2, 'alice'),
    joneses: group('joneses', 15, 2, 'carol'),
  },
  userGroups: { alice: 'smiths', bob: 'smiths', carol: 'joneses', grace: 'joneses' },
  seasons,
  ...(season === 'current'
    ? { selectedSeason: 2 }
    : season
      ? { selectedSeason: Number(season) }
      : {}),
  maxQuestionsAsked: 12,
  success: true,
});

const meta: Meta<typeof Leaderboard> = {
  title: 'Leaderboard/Leaderboard',
  component: Leaderboard,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get('*/consolidated-leaderboard', ({ request }) =>
          HttpResponse.json({
            ok: true,
            data: results(new URL(request.url).searchParams.get('season')),
          }),
        ),
      ],
    },
    docs: {
      description: {
        component:
          'Trivia › Leaderboard: players and families for the season picked, the current one ' +
          'at first, in one request. Everyone with results keeps a row.',
      },
    },
  },
  args: { userId: 'alice' },
  decorators: [
    (Story) => (
      <StoryProviders>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Leaderboard>;

/** Opens on the current season, with everyone who played in it */
export const ThisSeason: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Summer/)).toBeInTheDocument();
    await expect((await canvas.findAllByText(/grace/i)).length).toBeGreaterThan(0);
  },
};

/** Nobody has results yet */
export const NoResultsYet: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/consolidated-leaderboard', () =>
          HttpResponse.json({
            ok: true,
            data: { users: {}, groups: {}, userGroups: {}, seasons: [], success: true },
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Load Leaderboard')).toBeInTheDocument();
  },
};
