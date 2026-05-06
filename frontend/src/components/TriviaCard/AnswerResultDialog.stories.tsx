import { fn } from 'storybook/test';

import AnswerResultDialog from './AnswerResultDialog';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const sampleQuestion = {
  question: 'Which planet has the most moons in our solar system?',
  choices: ['Earth', 'Jupiter', 'Saturn', 'Neptune'],
  answer: 'Saturn',
  category: 'Science & Nature',
  difficulty: 'normal' as const,
};

const meta: Meta<typeof AnswerResultDialog> = {
  title: 'TriviaCard/AnswerResultDialog',
  component: AnswerResultDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onClose: fn(),
    onNext: fn(),
    question: sampleQuestion,
    selected: 'Saturn',
    isCorrect: true,
    streak: 5,
    pointsEarned: 10,
    userId: 'alice',
    answerTimestamp: '2026-04-10T14:30:00.000Z',
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof AnswerResultDialog>;

export const Correct: Story = {};

export const Incorrect: Story = {
  args: { selected: 'Jupiter', isCorrect: false, pointsEarned: 0, streak: 0 },
};

export const CatchingUp: Story = {
  args: { isCatchingUp: true },
};

export const NoStreak: Story = {
  args: { streak: 0 },
};
