import React from 'react';
import { expect, within } from 'storybook/test';

import TriviaFlow from './TriviaFlow';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Mock last-answered question for done state
const mockHistory = {
  question: {
    question: 'In what year did the Berlin Wall fall?',
    choices: ['1987', '1989', '1991', '1993'],
    answer: '1989',
    category: 'History',
    difficulty: 'normal' as const,
  },
  selectedAnswer: '1989',
  correct: true,
  pointsEarned: 1,
  streak: 3,
  timestamp: new Date(Date.now() - 3600_000).toISOString(),
  isCustomCategory: false,
};

const mockHistoryWrong = {
  ...mockHistory,
  selectedAnswer: '1991',
  correct: false,
  pointsEarned: 0,
  streak: 0,
};

const meta: Meta<typeof TriviaFlow> = {
  title: 'Trivia/Flow/TriviaFlow',
  component: TriviaFlow,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Main trivia flow card. States: idle (category grid), difficulty, generating, answering, result, done. ' +
          'Uses a 3-step pipeline for question generation: Generate → Dedup → Fact-check, ' +
          'with real progress messages at each step. Handles catch-up questions, daily limit, and game modes.',
      },
    },
  },
  args: {
    userId: 'alice',
    groupId: 'smiths',
  },
  argTypes: {
    onAnswerResult: { action: 'answerResult' },
    forceDisabled: { control: 'boolean' },
    __mockHistory: { table: { disable: true } },
  },
  decorators: [
    (Story, context) => (
      <StoryProviders
        userStatus={context.parameters.userStatus}
        trivia={context.parameters.trivia}
        family={context.parameters.family}
        timeline={context.parameters.timeline}
      >
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof TriviaFlow>;

// ── Stories ──────────────────────────────────────────────────────────

/** Idle state — category grid with game modes, user can pick a category */
export const Idle: Story = {
  parameters: {
    userStatus: { hasAnsweredToday: false, canAnswerQuestion: true },
  },
};

/** Done for the day — shows last correct answer + countdown timer */
export const DoneCorrect: Story = {
  args: { __mockHistory: mockHistory },
  parameters: {
    userStatus: { hasAnsweredToday: true, canAnswerQuestion: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Berlin Wall/)).toBeInTheDocument();
    await expect(canvas.getByText(/Next question in/)).toBeInTheDocument();
  },
};

/** Done for the day — shows last wrong answer + countdown timer */
export const DoneWrong: Story = {
  args: { __mockHistory: mockHistoryWrong },
  parameters: {
    userStatus: { hasAnsweredToday: true, canAnswerQuestion: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Berlin Wall/)).toBeInTheDocument();
  },
};

/** Catching up — user has 3 questions behind */
export const CatchingUp: Story = {
  parameters: {
    userStatus: {
      hasAnsweredToday: false,
      canAnswerQuestion: true,
      questionsBehind: 3,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/3 remaining/)).toBeInTheDocument();
  },
};

/** Catch-up + daily already used — can still catch up but daily is done */
export const CatchUpDailyUsed: Story = {
  parameters: {
    userStatus: {
      hasAnsweredToday: true,
      canAnswerQuestion: false,
      questionsBehind: 2,
    },
  },
};

/** Context still loading — shows loading dots, categories locked */
export const LoadingCatchup: Story = {
  parameters: {
    userStatus: { loadingCatchup: true },
  },
};

/** Force disabled — renders nothing (another user's card is active) */
export const ForceDisabled: Story = {
  args: { forceDisabled: true },
};

/** Game modes on cooldown — tiles show locked with countdown */
export const GameModesLocked: Story = {
  parameters: {
    userStatus: { hasAnsweredToday: false, canAnswerQuestion: true },
    trivia: {
      canPlayCasinoRush: false,
      canPlaySlotMachine: false,
      canPlayCurling: false,
    },
  },
};

/** All game modes available */
export const GameModesAvailable: Story = {
  parameters: {
    userStatus: { hasAnsweredToday: false, canAnswerQuestion: true },
    trivia: {
      canPlayCasinoRush: true,
      canPlaySlotMachine: true,
      canPlayCurling: true,
    },
  },
};

/** Done with no history — shows viewOnly category grid as fallback */
export const DoneNoHistory: Story = {
  args: { __mockHistory: null },
  parameters: {
    userStatus: { hasAnsweredToday: true, canAnswerQuestion: false },
  },
};

/**
 * Interactive generation flow using MSW-mocked step pipeline.
 *
 * Click a category then a difficulty to see the real 3-step progress:
 * 1. "Generating your question..." (step 1)
 * 2. "Checking it hasn't been asked before..." (step 2)
 * 3. "Verifying the answer..." (step 3)
 *
 * MSW handlers return a mock question after realistic delays.
 */
export const GenerationFlow: Story = {
  parameters: {
    userStatus: { hasAnsweredToday: false, canAnswerQuestion: true },
    docs: {
      description: {
        story: 'Select a category and difficulty to see the 3-step pipeline with real progress messages. ' +
          'MSW intercepts API calls and returns mock data with realistic delays.',
      },
    },
  },
};
