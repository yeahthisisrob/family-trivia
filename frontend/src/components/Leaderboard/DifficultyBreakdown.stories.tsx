import DifficultyBreakdown from './DifficultyBreakdown';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DifficultyBreakdown> = {
  title: 'Leaderboard/DifficultyBreakdown',
  component: DifficultyBreakdown,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof DifficultyBreakdown>;

export const Default: Story = {
  args: {
    stats: { easy: 5, normal: 12, hard: 3, total: 20 },
  },
};

export const MostlyHard: Story = {
  args: {
    stats: { easy: 1, normal: 4, hard: 15, total: 20 },
  },
};

export const Empty: Story = {
  args: {
    stats: { easy: 0, normal: 0, hard: 0, total: 0 },
  },
};
