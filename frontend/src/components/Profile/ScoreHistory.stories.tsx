import { fn } from 'storybook/test';

import ScoreHistory from './ScoreHistory';

import type { Meta, StoryObj } from '@storybook/react-vite';

const sampleHistory = [
  {
    date: '2026-04-10T14:30:00.000Z',
    gameType: 'trivia',
    category: 'Science & Nature',
    difficulty: 'normal',
    pointsAttempted: 1,
    pointsEarned: 1,
    correct: true,
    question: 'Which planet has the most moons?',
    userAnswer: 'Saturn',
    correctAnswer: 'Saturn',
    isCasinoRush: false,
  },
  {
    date: '2026-04-09T10:15:00.000Z',
    gameType: 'trivia',
    category: 'History & Politics',
    difficulty: 'hard',
    pointsAttempted: 2,
    pointsEarned: 0,
    correct: false,
    question: 'In what year was the Magna Carta signed?',
    userAnswer: '1220',
    correctAnswer: '1215',
    isCasinoRush: false,
  },
];

const meta: Meta<typeof ScoreHistory> = {
  title: 'Profile/ScoreHistory',
  component: ScoreHistory,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onClose: fn(),
    scoringHistory: sampleHistory,
    totalScore: 42,
  },
};
export default meta;
type Story = StoryObj<typeof ScoreHistory>;

export const Default: Story = {};

export const Empty: Story = {
  args: { scoringHistory: [], totalScore: 0 },
};
