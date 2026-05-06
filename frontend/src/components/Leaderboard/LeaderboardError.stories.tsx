import { fn } from 'storybook/test';

import LeaderboardError from './LeaderboardError';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof LeaderboardError> = {
  title: 'Leaderboard/LeaderboardError',
  component: LeaderboardError,
  parameters: { layout: 'padded' },
  args: {
    message: 'Could not load leaderboard data. Please check your connection.',
    onRetry: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof LeaderboardError>;

export const Default: Story = {};

export const ShortMessage: Story = {
  args: { message: 'Offline.' },
};
