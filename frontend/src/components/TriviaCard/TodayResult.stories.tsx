import TodayResult from './TodayResult';

import type { Meta, StoryObj } from '@storybook/react-vite';

const sampleQuestion = {
  question: 'Which planet has the most moons in our solar system?',
  choices: ['Earth', 'Jupiter', 'Saturn', 'Neptune'],
  answer: 'Saturn',
  category: 'Science & Nature',
  difficulty: 'normal' as const,
};

const meta: Meta<typeof TodayResult> = {
  title: 'TriviaCard/TodayResult',
  component: TodayResult,
  parameters: { layout: 'padded' },
  args: {
    question: sampleQuestion,
    selected: 'Saturn',
    result: { correct: true, streak: 5, pointsEarned: 1 },
  },
};
export default meta;
type Story = StoryObj<typeof TodayResult>;

export const Correct: Story = {};

export const Incorrect: Story = {
  args: {
    selected: 'Jupiter',
    result: { correct: false, streak: 0, pointsEarned: 0 },
  },
};

export const HardDifficulty: Story = {
  args: {
    question: { ...sampleQuestion, difficulty: 'hard' },
    result: { correct: true, streak: 3, pointsEarned: 2 },
  },
};
