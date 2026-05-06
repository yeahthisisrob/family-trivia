import React from 'react';
import { fn } from 'storybook/test';

import SnakeGame from './SnakeGame';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const installMockFetch = () => {
  const realFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/snake/questions')) {
      return new Response(JSON.stringify({
        ok: true,
        data: {
          questions: [
            { clue: "Rob's favorite color", answer: 'BLUE' },
            { clue: 'Capital of France', answer: 'PARIS' },
            { clue: "Blair's dream city", answer: 'HAWAII' },
            { clue: 'Largest ocean', answer: 'PACIFIC' },
            { clue: "Betty's favorite dessert", answer: 'PIE' },
            { clue: 'Fastest land animal', answer: 'CHEETAH' },
            { clue: "Bob's pet type", answer: 'DOG' },
            { clue: 'Frozen water', answer: 'ICE' },
            { clue: 'Opposite of night', answer: 'DAY' },
            { clue: "Shawn's favorite sport", answer: 'SOCCER' },
          ],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/arcade/submit-score')) {
      return new Response(JSON.stringify({
        ok: true,
        data: { isNewHighScore: true, rank: 1, previousBest: 0, highScores: [] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return realFetch(input, init);
  };
  return () => { window.fetch = realFetch; };
};

const meta: Meta<typeof SnakeGame> = {
  title: 'Trivia/Game Modes/SnakeGame',
  component: SnakeGame,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Classic Snake with a trivia twist — collect letters in order to spell answers. Wrong letters shrink the snake. Score = words completed.',
      },
    },
  },
  args: {
    userId: 'storybook-user',
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
type Story = StoryObj<typeof SnakeGame>;

/** Interactive — play Snake and collect trivia letters */
export const Interactive: Story = {};

/** Close button */
export const CloseButton: Story = {
  args: { onClose: fn() },
};
