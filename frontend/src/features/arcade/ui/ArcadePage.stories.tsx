import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import ArcadePage from './ArcadePage';

const scores = [
  { userId: 'alice', score: 1200, date: '2026-04-05T10:00:00Z', mode: 'arcade' },
  { userId: 'dave', score: 950, date: '2026-04-04T15:30:00Z', mode: 'trivia' },
  { userId: 'bob', score: 800, date: '2026-04-03T09:00:00Z', mode: 'arcade' },
  { userId: 'carol', score: 600, date: '2026-04-02T12:00:00Z', mode: 'trivia' },
  { userId: 'frank', score: 450, date: '2026-04-01T18:00:00Z', mode: 'arcade' },
];

const handlers = [
  http.get('*/games/scores', ({ request }) =>
    HttpResponse.json({
      ok: true,
      data: { game: new URL(request.url).searchParams.get('game'), scores },
    }),
  ),
  http.post('*/games/scores', () =>
    HttpResponse.json({
      ok: true,
      data: { isNewHighScore: true, rank: 2, previousBest: 800, highScores: [] },
    }),
  ),
];

const meta: Meta<typeof ArcadePage> = {
  title: 'Arcade/ArcadePage',
  component: ArcadePage,
  parameters: {
    layout: 'padded',
    msw: { handlers },
    docs: {
      description: {
        component:
          'Arcade tab — game selector with high score leaderboards. ' +
          'Play any game unlimited, compete for high scores. The board shown is ' +
          "the game on screen's, asked when it comes on screen.",
      },
    },
  },
  args: { userId: 'dave' },
  decorators: [
    (Story) => (
      <StoryProviders>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ArcadePage>;

/** Default view with game cards and the first game's high scores */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('1,200')).toBeInTheDocument();
  },
};

/** Interactive — click Play to launch a game in arcade mode */
export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Click "Play" on a game to launch it in arcade mode (unlimited, no trivia question).',
      },
    },
  },
};
