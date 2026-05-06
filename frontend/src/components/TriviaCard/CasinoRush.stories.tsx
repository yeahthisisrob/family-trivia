import React from 'react';
import { expect, fn, within } from 'storybook/test';

import { CasinoRush } from './CasinoRush';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Stub fetch for Casino Rush endpoints so the game is playable in Storybook.
const installMockFetch = () => {
  const realFetch = window.fetch;
  let questionIndex = 0;
  const questions = [
    { question: 'What is the capital of France?', choices: ['Paris', 'London', 'Berlin', 'Madrid'], answer: 'Paris', category: 'Geography & Travel', difficulty: 'normal' },
    { question: 'Who painted the Mona Lisa?', choices: ['Da Vinci', 'Picasso', 'Van Gogh', 'Monet'], answer: 'Da Vinci', category: 'Literature & Arts', difficulty: 'normal' },
    { question: 'What year did WW2 end?', choices: ['1945', '1944', '1946', '1943'], answer: '1945', category: 'History & Politics', difficulty: 'normal' },
  ];

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/casino-rush/start')) {
      questionIndex = 0;
      return new Response(JSON.stringify({
        ok: true,
        data: {
          session: {
            currentQuestion: questions[0],
            questionNumber: 1,
            totalQuestions: 3,
            questions: questions.map(q => ({ ...q, userAnswer: null })),
            status: 'active',
          },
          messages: [
            { type: 'checking', message: 'Generating questions...', timestamp: Date.now() },
            { type: 'success', message: 'Questions ready!', timestamp: Date.now() + 200 },
          ],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/casino-rush/answer')) {
      const body = JSON.parse((init?.body as string) || '{}');
      const currentQ = questions[questionIndex];
      const correct = body.answer === currentQ?.answer;
      questionIndex++;
      const gameOver = questionIndex >= 3;

      return new Response(JSON.stringify({
        ok: true,
        data: {
          correct,
          correctAnswer: currentQ?.answer || 'Paris',
          pointsEarned: correct ? 1 : 0,
          earnedPoints: correct ? questionIndex : 0,
          questionNumber: questionIndex,
          totalQuestions: 3,
          gameOver,
          complete: gameOver && correct,
          nextQuestion: gameOver ? null : questions[questionIndex],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return realFetch(input, init);
  };
  return () => { window.fetch = realFetch; };
};

const meta: Meta<typeof CasinoRush> = {
  title: 'Trivia/Game Modes/CasinoRush',
  component: CasinoRush,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'Casino Rush — weekly 3-question speed round.',
          'Answer all 3 correctly within 60s each to earn triple points.',
          'Get any wrong and you bust (0 points).',
        ].join('\n'),
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
          <div style={{ maxWidth: 400, margin: '0 auto' }}><Story /></div>
        </StoryProviders>
      );
    },
  ],
};
export default meta;
type Story = StoryObj<typeof CasinoRush>;

export const StartScreen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Casino Rush')).toBeInTheDocument();
    await expect(canvas.getByText('Triple or Nothing!')).toBeInTheDocument();
    // Difficulty chips
    await expect(canvas.getByText(/Easy/)).toBeInTheDocument();
    await expect(canvas.getByText(/Normal/)).toBeInTheDocument();
    await expect(canvas.getByText(/Hard/)).toBeInTheDocument();
  },
};

export const InteractiveDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Try it: pick a difficulty, answer 3 questions. Get all right to win.',
      },
    },
  },
};

export const CancelButton: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Cancel')).toBeInTheDocument();
  },
};
