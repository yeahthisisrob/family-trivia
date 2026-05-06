import React from 'react';
import { expect, within } from 'storybook/test';

import HistoryCard from './HistoryCard';
import { StubTimelineProvider } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof HistoryCard> = {
  title: 'Trivia/Cards/HistoryCard',
  component: HistoryCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Read-only card that shows a past trivia answer. Used in the carousel history stack and in the done-state of TriviaFlow. The top-border accent + chip colors reflect correct/incorrect.',
      },
    },
  },
  argTypes: {
    correct: { control: 'boolean' },
    pointsEarned: { control: { type: 'number', min: 0, max: 20 } },
    category: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <StubTimelineProvider>
        <div style={{ maxWidth: 400 }}><Story /></div>
      </StubTimelineProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof HistoryCard>;

const baseArgs = {
  userId: 'alice',
  question: 'In what year did the Roman Empire fall?',
  choices: ['410 AD', '476 AD', '527 AD', '800 AD'],
  answer: '476 AD',
  timestamp: new Date('2026-04-01T14:00:00Z').toISOString(),
  category: 'History',
};

export const CorrectAnswer: Story = {
  args: {
    ...baseArgs,
    selectedAnswer: '476 AD',
    correct: true,
    pointsEarned: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The question should render
    await expect(canvas.getByText(/Roman Empire/)).toBeInTheDocument();
    // All four choices render
    await expect(canvas.getByText('410 AD')).toBeInTheDocument();
    await expect(canvas.getByText('476 AD')).toBeInTheDocument();
    // Points chip shows
    await expect(canvas.getByText('+1')).toBeInTheDocument();
  },
};

export const IncorrectAnswer: Story = {
  args: {
    ...baseArgs,
    selectedAnswer: '410 AD',
    correct: false,
    pointsEarned: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('410 AD')).toBeInTheDocument();
    // No points chip when 0
    await expect(canvas.queryByText('+0')).not.toBeInTheDocument();
  },
};

export const WithHighPoints: Story = {
  args: {
    ...baseArgs,
    selectedAnswer: '476 AD',
    correct: true,
    pointsEarned: 5,
    category: 'Casino Rush',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('+5')).toBeInTheDocument();
    await expect(canvas.getByText('Casino Rush')).toBeInTheDocument();
  },
};

export const LongQuestionText: Story = {
  args: {
    ...baseArgs,
    question: 'Which of these countries was NOT one of the 13 original member states that signed the North Atlantic Treaty at the founding of NATO on April 4, 1949 in Washington, D.C.?',
    choices: ['Canada', 'Norway', 'Spain', 'Portugal'],
    answer: 'Spain',
    selectedAnswer: 'Spain',
    correct: true,
    pointsEarned: 2,
  },
};

export const ZeroPoints: Story = {
  args: {
    ...baseArgs,
    selectedAnswer: '410 AD',
    correct: false,
    pointsEarned: 0,
    category: 'History',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // "+0" points chip should NOT render
    await expect(canvas.queryByText('+0')).not.toBeInTheDocument();
  },
};

export const NoCategoryChip: Story = {
  args: {
    ...baseArgs,
    selectedAnswer: '476 AD',
    correct: true,
    pointsEarned: 1,
    category: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('History')).not.toBeInTheDocument();
  },
};

export const HighMultiplierWin: Story = {
  args: {
    ...baseArgs,
    category: 'Slot Machine',
    pointsEarned: 10,
    selectedAnswer: '476 AD',
    correct: true,
  },
  parameters: {
    docs: { description: { story: '10x slot machine jackpot win.' } },
  },
};

export const ShortQuestionShortAnswers: Story = {
  args: {
    userId: 'alice',
    question: 'Capital of France?',
    choices: ['Lyon', 'Paris', 'Nice', 'Bordeaux'],
    answer: 'Paris',
    selectedAnswer: 'Paris',
    correct: true,
    pointsEarned: 1,
    category: 'Geography',
    timestamp: new Date('2026-04-04T10:00:00Z').toISOString(),
  },
};
