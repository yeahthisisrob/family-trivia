import { fn } from 'storybook/test';

import PlayerCard from './PlayerCard';

import type { LeaderboardEntry } from './utils';
import type { Meta, StoryObj } from '@storybook/react-vite';

const alice: LeaderboardEntry = {
  userId: 'alice',
  score: 52,
  streak: 5,
  accuracy: 92,
  questionsAnswered: 40,
  categoryScores: {
    'History & Politics': 12,
    'Science & Nature': 18,
    'Pop Culture': 8,
  },
  difficultyStats: { easy: 5, normal: 25, hard: 10, total: 40 },
  avgPointsPerQuestion: 1.3,
  pointBreakdown: {
    regularPoints: 40,
    gameModePoints: 8,
    arcadeBonusPoints: 2,
    familyFeudPoints: 2,
  },
};

const meta: Meta<typeof PlayerCard> = {
  title: 'Leaderboard/PlayerCard',
  component: PlayerCard,
  parameters: { layout: 'padded' },
  args: {
    player: alice,
    rank: 1,
    isCurrentUser: false,
    onViewProfile: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof PlayerCard>;

export const Default: Story = {};

export const CurrentUser: Story = {
  args: { isCurrentUser: true },
};

export const SecondPlace: Story = {
  args: { rank: 2 },
};

export const LowScore: Story = {
  args: {
    player: {
      ...alice,
      userId: 'newbie',
      score: 3,
      streak: 0,
      accuracy: 40,
      questionsAnswered: 5,
    },
    rank: 10,
  },
};
