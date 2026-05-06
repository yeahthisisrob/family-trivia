import { Box } from '@mui/material';
import React from 'react';

import NotificationItem from './NotificationItem';

import type { NotificationItem as NotificationItemType } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof NotificationItem> = {
  title: 'Notifications/NotificationItem',
  component: NotificationItem,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 320 }}>
        <Story />
      </Box>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof NotificationItem>;

const baseComment: NotificationItemType = {
  id: 'comment-trivia-abc',
  type: 'comment',
  timestamp: new Date(Date.now() - 300_000).toISOString(),
  read: false,
  contentType: 'trivia',
  contentId: 'abc',
  commentUserId: 'bob',
  commentText: 'Great question! I totally guessed on this one.',
  threadCommentCount: 2,
};

export const UnreadComment: Story = {
  args: { item: baseComment },
};

export const ReadComment: Story = {
  args: { item: { ...baseComment, read: true } },
};

export const FactComment: Story = {
  args: {
    item: {
      ...baseComment,
      contentType: 'fact',
      contentId: 'alice_2026-04-05',
      commentUserId: 'carol',
      commentText: 'That is so cool!',
      threadCommentCount: 1,
    },
  },
};

export const LeaderChangeIndividual: Story = {
  args: {
    item: {
      id: 'leader-ind',
      type: 'leader_change',
      timestamp: new Date(Date.now() - 600_000).toISOString(),
      read: false,
      leaderType: 'individual',
      newLeaderId: 'alice',
      previousLeaderId: 'bob',
    },
  },
};

export const LeaderChangeGroup: Story = {
  args: {
    item: {
      id: 'leader-grp',
      type: 'leader_change',
      timestamp: new Date(Date.now() - 900_000).toISOString(),
      read: false,
      leaderType: 'group',
      newLeaderId: 'Team Alpha',
      previousLeaderId: 'Team Beta',
    },
  },
};
