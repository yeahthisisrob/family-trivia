import { fn } from 'storybook/test';

import Podium from './Podium';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Podium> = {
  title: 'Leaderboard/Podium',
  component: Podium,
  parameters: { layout: 'padded' },
  args: { onPlayerClick: fn() },
};
export default meta;
type Story = StoryObj<typeof Podium>;

export const ThreePlayers: Story = {
  args: {
    players: [
      { userId: 'betty', score: 52, rank: 1, streak: 5, accuracy: 92, questionsAnswered: 40 },
      { userId: 'bob', score: 48, rank: 2, streak: 2, accuracy: 88, questionsAnswered: 38 },
      { userId: 'freddy', score: 41, rank: 3, streak: 0, accuracy: 75, questionsAnswered: 35 },
    ],
  },
};

export const TwoPlayers: Story = {
  args: {
    players: [
      { userId: 'alice', score: 52, rank: 1, streak: 5 },
      { userId: 'bob', score: 48, rank: 2, streak: 2 },
    ],
  },
};

export const GroupView: Story = {
  args: {
    isGroupView: true,
    players: [
      { userId: 'kids', score: 150, rank: 1 },
      { userId: 'parents', score: 142, rank: 2 },
      { userId: 'grands', score: 128, rank: 3 },
    ],
  },
};
