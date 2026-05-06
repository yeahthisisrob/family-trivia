import { fn } from 'storybook/test';

import GroupRankings from './GroupRankings';

import type { LeaderboardEntry, GroupScore } from './utils';
import type { Meta, StoryObj } from '@storybook/react-vite';

const players: LeaderboardEntry[] = [
  { userId: 'alice', score: 52, streak: 5, accuracy: 92, questionsAnswered: 40, pointBreakdown: { regularPoints: 40, gameModePoints: 8, arcadeBonusPoints: 2, familyFeudPoints: 2 } },
  { userId: 'bob', score: 48, streak: 2, accuracy: 88, questionsAnswered: 38, pointBreakdown: { regularPoints: 38, gameModePoints: 6, arcadeBonusPoints: 2, familyFeudPoints: 2 } },
];

const groups: GroupScore[] = [
  { groupId: 'parents', totalScore: 100, memberCount: 2, topScorer: 'alice', topScore: 52, averageScore: 50 },
  { groupId: 'kids', totalScore: 75, memberCount: 2, topScorer: 'charlie', topScore: 41, averageScore: 37.5 },
];

const meta: Meta<typeof GroupRankings> = {
  title: 'Leaderboard/GroupRankings',
  component: GroupRankings,
  parameters: { layout: 'padded' },
  args: {
    groups,
    players,
    userGroups: { alice: 'parents', bob: 'parents', charlie: 'kids', dana: 'kids' },
    onViewProfile: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof GroupRankings>;

export const Default: Story = {};

export const Empty: Story = {
  args: { groups: [], players: [] },
};
