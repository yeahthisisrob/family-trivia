import React from 'react';

import ArcadePage from './ArcadePage';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Mock fetch for arcade endpoints
const installMockFetch = () => {
  const realFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/arcade/leaderboard')) {
      const scores = [
        { userId: 'alice', score: 1200, date: '2026-04-05T10:00:00Z', mode: 'arcade' },
        { userId: 'rob', score: 950, date: '2026-04-04T15:30:00Z', mode: 'trivia' },
        { userId: 'bob', score: 800, date: '2026-04-03T09:00:00Z', mode: 'arcade' },
        { userId: 'carol', score: 600, date: '2026-04-02T12:00:00Z', mode: 'trivia' },
        { userId: 'shawn', score: 450, date: '2026-04-01T18:00:00Z', mode: 'arcade' },
      ];
      return new Response(JSON.stringify({
        ok: true,
        data: { game: url.includes('tetris') ? 'tetris' : 'curling', scores },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/arcade/submit-score')) {
      return new Response(JSON.stringify({
        ok: true,
        data: { isNewHighScore: true, rank: 2, previousBest: 800, highScores: [] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return realFetch(input, init);
  };
  return () => { window.fetch = realFetch; };
};

const meta: Meta<typeof ArcadePage> = {
  title: 'Arcade/ArcadePage',
  component: ArcadePage,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Arcade tab — game selector with high score leaderboards. ' +
          'Play Tetris or Curling unlimited, compete for high scores.',
      },
    },
  },
  args: { userId: 'rob' },
  decorators: [
    (Story) => {
      React.useEffect(() => installMockFetch(), []);
      return (
        <StoryProviders>
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <Story />
          </div>
        </StoryProviders>
      );
    },
  ],
};
export default meta;
type Story = StoryObj<typeof ArcadePage>;

/** Default view with game cards and leaderboards */
export const Default: Story = {};

/** Interactive — click Play to launch a game in arcade mode */
export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Click "Play" on either game to launch it in arcade mode (unlimited, no trivia question).',
      },
    },
  },
};
