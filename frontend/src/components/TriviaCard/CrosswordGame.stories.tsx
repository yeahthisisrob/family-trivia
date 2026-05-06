import React from 'react';
import { fn } from 'storybook/test';

import CrosswordGame from './CrosswordGame';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Dense crossword mock — lots of intersections like a real newspaper puzzle
const MOCK_CROSSWORD = {
  size: 11,
  grid: [
    ['.', '.', 'P', '.', '.', 'G', '.', '.', '.', '.', '.'],
    ['.', '.', 'A', '.', '.', 'R', '.', '.', '.', '.', '.'],
    ['W', 'H', 'A', 'L', 'E', 'E', '.', '.', 'C', '.', '.'],
    ['.', 'A', 'R', '.', '.', 'E', '.', '.', 'A', '.', '.'],
    ['.', 'N', 'I', 'L', 'E', 'C', 'E', '.', 'I', '.', '.'],
    ['.', 'O', 'S', '.', '.', 'E', '.', '.', 'R', '.', '.'],
    ['.', 'I', '.', '.', 'T', '.', '.', '.', 'O', '.', '.'],
    ['.', '.', '.', '.', 'O', 'R', 'I', 'G', 'I', 'N', '.'],
    ['.', '.', '.', '.', 'K', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', 'Y', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', 'O', 'C', 'E', 'A', 'N', '.', '.'],
  ],
  clues: [
    { number: 1, clue: 'Rob\'s pet that he walks every morning', answer: 'WHALE', row: 2, col: 0, direction: 'across' as const },
    { number: 2, clue: 'Blair\'s dream vacation city', answer: 'PARIS', row: 0, col: 2, direction: 'down' as const },
    { number: 3, clue: 'Where Betty went on her honeymoon', answer: 'GREECE', row: 0, col: 5, direction: 'down' as const },
    { number: 4, clue: 'Becky\'s favorite Vietnamese restaurant name', answer: 'HANOI', row: 2, col: 1, direction: 'down' as const },
    { number: 5, clue: 'Bob\'s go-to trivia answer for longest river', answer: 'NILE', row: 4, col: 1, direction: 'across' as const },
    { number: 6, clue: 'What Chris puts in every drink', answer: 'ICE', row: 4, col: 4, direction: 'across' as const },
    { number: 7, clue: 'Shawn\'s favorite city to visit', answer: 'CAIRO', row: 2, col: 8, direction: 'down' as const },
    { number: 8, clue: 'Dawn\'s favorite math concept', answer: 'ORIGIN', row: 7, col: 3, direction: 'across' as const },
    { number: 9, clue: 'Mark\'s bucket list destination', answer: 'TOKYO', row: 6, col: 4, direction: 'down' as const },
    { number: 10, clue: 'What Rob says he could stare at forever', answer: 'OCEAN', row: 10, col: 4, direction: 'across' as const },
  ],
};

const installMockFetch = () => {
  const realFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/crossword/generate')) {
      await new Promise(r => setTimeout(r, 1500));
      return new Response(JSON.stringify({ ok: true, data: MOCK_CROSSWORD }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/arcade/submit-score')) {
      return new Response(JSON.stringify({
        ok: true, data: { isNewHighScore: true, rank: 1, previousBest: 0, highScores: [] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return realFetch(input, init);
  };
  return () => { window.fetch = realFetch; };
};

const meta: Meta<typeof CrosswordGame> = {
  title: 'Trivia/Game Modes/CrosswordGame',
  component: CrosswordGame,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Crossword puzzle generated from family facts. Fill in the grid, check your answers, compete for high scores.',
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
type Story = StoryObj<typeof CrosswordGame>;

/** Interactive — generates a crossword and lets you play */
export const Interactive: Story = {};

/** Close button */
export const CloseButton: Story = {
  args: { onClose: fn() },
};
