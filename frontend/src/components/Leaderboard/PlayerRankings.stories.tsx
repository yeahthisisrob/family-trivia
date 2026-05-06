import { fn } from 'storybook/test';

import PlayerRankings from './PlayerRankings';

import type { LeaderboardEntry } from './utils';
import type { Meta, StoryObj } from '@storybook/react-vite';

const players: LeaderboardEntry[] = [
  { userId: 'alice', score: 52, streak: 5, accuracy: 92, questionsAnswered: 40, pointBreakdown: { regularPoints: 40, gameModePoints: 8, arcadeBonusPoints: 2, familyFeudPoints: 2 } },
  { userId: 'bob', score: 48, streak: 2, accuracy: 88, questionsAnswered: 38, pointBreakdown: { regularPoints: 38, gameModePoints: 6, arcadeBonusPoints: 2, familyFeudPoints: 2 } },
  { userId: 'charlie', score: 41, streak: 0, accuracy: 75, questionsAnswered: 35, pointBreakdown: { regularPoints: 35, gameModePoints: 4, arcadeBonusPoints: 1, familyFeudPoints: 1 } },
  { userId: 'dana', score: 28, streak: 1, accuracy: 70, questionsAnswered: 25, pointBreakdown: { regularPoints: 25, gameModePoints: 2, arcadeBonusPoints: 1, familyFeudPoints: 0 } },
];

const meta: Meta<typeof PlayerRankings> = {
  title: 'Leaderboard/PlayerRankings',
  component: PlayerRankings,
  parameters: { layout: 'padded' },
  args: {
    players,
    currentUserId: 'bob',
    onViewProfile: fn(),
    maxQuestionsAsked: 40,
  },
};
export default meta;
type Story = StoryObj<typeof PlayerRankings>;

export const Default: Story = {};

export const Empty: Story = {
  args: { players: [] },
};

export const SinglePlayer: Story = {
  args: { players: [players[0]] },
};
