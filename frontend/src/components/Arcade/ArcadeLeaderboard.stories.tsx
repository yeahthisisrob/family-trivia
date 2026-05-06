import { Box } from '@mui/material';
import React from 'react';

import ArcadeLeaderboard from './ArcadeLeaderboard';

import type { HighScoreEntry } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';

const mockScores: HighScoreEntry[] = [
  { userId: 'alice', score: 1200, date: new Date(Date.now() - 86400000).toISOString(), mode: 'arcade' },
  { userId: 'rob', score: 950, date: new Date(Date.now() - 172800000).toISOString(), mode: 'trivia' },
  { userId: 'bob', score: 800, date: new Date(Date.now() - 259200000).toISOString(), mode: 'arcade' },
  { userId: 'carol', score: 600, date: new Date(Date.now() - 345600000).toISOString(), mode: 'trivia' },
  { userId: 'shawn', score: 450, date: new Date(Date.now() - 432000000).toISOString(), mode: 'arcade' },
  { userId: 'betty', score: 300, date: new Date(Date.now() - 518400000).toISOString(), mode: 'trivia' },
];

const meta: Meta<typeof ArcadeLeaderboard> = {
  title: 'Arcade/ArcadeLeaderboard',
  component: ArcadeLeaderboard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 360 }}>
        <Story />
      </Box>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ArcadeLeaderboard>;

export const Default: Story = {
  args: {
    scores: mockScores,
    currentUserId: 'rob',
  },
};

export const WithNewRecord: Story = {
  args: {
    scores: mockScores,
    currentUserId: 'rob',
    newRecordUserId: 'rob',
  },
};

export const Top3Only: Story = {
  args: {
    scores: mockScores.slice(0, 3),
    currentUserId: 'bob',
    maxItems: 3,
  },
};

export const Empty: Story = {
  args: {
    scores: [],
    currentUserId: 'rob',
  },
};
