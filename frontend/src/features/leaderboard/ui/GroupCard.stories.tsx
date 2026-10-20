import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { GroupResult, PlayerResult } from '../../../entities/leaderboard';
import GroupCard from './GroupCard';

const players: PlayerResult[] = [
  {
    userId: 'alice',
    score: 52,
    streak: 5,
    accuracy: 92,
    questionsAnswered: 40,
    pointBreakdown: {
      regularPoints: 40,
      gameModePoints: 8,
      arcadeBonusPoints: 2,
      familyFeudPoints: 2,
    },
  },
  {
    userId: 'bob',
    score: 48,
    streak: 2,
    accuracy: 88,
    questionsAnswered: 38,
    pointBreakdown: {
      regularPoints: 38,
      gameModePoints: 6,
      arcadeBonusPoints: 2,
      familyFeudPoints: 2,
    },
  },
];

const group: GroupResult = {
  groupId: 'parents',
  totalScore: 100,
  memberCount: 2,
  topScorer: 'alice',
  topScore: 52,
  averageScore: 50,
};

const meta: Meta<typeof GroupCard> = {
  title: 'Leaderboard/GroupCard',
  component: GroupCard,
  parameters: { layout: 'padded' },
  args: {
    group,
    groupPlayers: players,
    rank: 1,
    onViewProfile: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof GroupCard>;

export const Default: Story = {};

export const SecondPlace: Story = {
  args: { rank: 2 },
};
