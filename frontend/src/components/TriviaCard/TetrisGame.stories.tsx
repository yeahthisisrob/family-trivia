import React from 'react';
import { fn } from 'storybook/test';

import TetrisGame from './TetrisGame';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Mock fetch for Tetris endpoints
const installMockFetch = () => {
  const realFetch = window.fetch;

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/tetris/lock')) {
      const body = JSON.parse((init?.body as string) || '{}');
      await new Promise(r => setTimeout(r, 1500)); // Simulate question generation
      return new Response(JSON.stringify({
        ok: true,
        data: {
          multiplier: body.multiplier || 1,
          question: {
            question: 'What company introduced the first commercially successful portable camera in 1888?',
            choices: ['Kodak', 'Polaroid', 'Canon', 'Leica'],
            category: 'History',
          },
          isNewHighScore: body.score > 500,
          highScores: [
            { userId: 'alice', score: 1200, date: '2026-04-01' },
            { userId: 'bob', score: 800, date: '2026-03-28' },
            { userId: 'carol', score: 450, date: '2026-03-25' },
          ],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/tetris/answer')) {
      const body = JSON.parse((init?.body as string) || '{}');
      const correct = body.answer === 'Kodak';
      return new Response(JSON.stringify({
        ok: true,
        data: {
          correct,
          correctAnswer: 'Kodak',
          pointsEarned: correct ? 2 : 0,
          multiplier: 2,
          highScoreBonus: 1,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return realFetch(input, init);
  };
  return () => { window.fetch = realFetch; };
};

const meta: Meta<typeof TetrisGame> = {
  title: 'Trivia/Game Modes/TetrisGame',
  component: TetrisGame,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Tetris game mode: 60 seconds to clear lines. Score determines trivia multiplier (1x/2x/3x). ' +
          'Features high score leaderboard with bonus point for new records. Weekly cooldown.',
      },
    },
  },
  args: {
    userId: 'storybook-user',
    isCatchingUp: false,
    onClose: fn(),
    onComplete: fn(),
  },
  decorators: [
    (Story) => {
      React.useEffect(() => installMockFetch(), []);
      return (
        <StoryProviders>
          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            <Story />
          </div>
        </StoryProviders>
      );
    },
  ],
};
export default meta;
type Story = StoryObj<typeof TetrisGame>;

/** Idle state — "Start Game" button visible */
export const Idle: Story = {};

/** Full interactive demo — play Tetris, answer trivia */
export const InteractiveDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Click "Start Game" to play 60 seconds of Tetris. Use the button controls ' +
          '(or arrow keys) to move pieces. Score determines your trivia multiplier.',
      },
    },
  },
};

/** Close button fires onClose */
export const CloseButton: Story = {
  args: {
    onClose: fn(),
  },
};
