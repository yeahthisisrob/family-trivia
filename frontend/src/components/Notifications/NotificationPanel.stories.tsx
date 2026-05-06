import { Box, Button } from '@mui/material';
import React, { useRef } from 'react';

import NotificationPanel from './NotificationPanel';

import type { NotificationItem } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';

const mockItems: NotificationItem[] = [
  {
    id: 'comment-trivia-abc',
    type: 'comment',
    timestamp: new Date(Date.now() - 300_000).toISOString(),
    read: false,
    contentType: 'trivia',
    contentId: 'abc',
    commentUserId: 'bob',
    commentText: 'Great question! I had no idea about this.',
    threadCommentCount: 2,
  },
  {
    id: 'comment-fact-alice_04-05',
    type: 'comment',
    timestamp: new Date(Date.now() - 1_800_000).toISOString(),
    read: false,
    contentType: 'fact',
    contentId: 'alice_04-05',
    commentUserId: 'carol',
    commentText: 'That is so cool!',
    threadCommentCount: 1,
  },
  {
    id: 'comment-trivia-def',
    type: 'comment',
    timestamp: new Date(Date.now() - 7_200_000).toISOString(),
    read: true,
    contentType: 'trivia',
    contentId: 'def',
    commentUserId: 'rob',
    commentText: 'I got this one wrong too',
    threadCommentCount: 1,
  },
];

const leaderItem: NotificationItem = {
  id: 'leader-individual',
  type: 'leader_change',
  timestamp: new Date(Date.now() - 600_000).toISOString(),
  read: false,
  leaderType: 'individual',
  newLeaderId: 'alice',
  previousLeaderId: 'bob',
};

// Wrapper to provide an anchor element
const PanelWrapper: React.FC<{ items: NotificationItem[] }> = ({ items }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(true);
  return (
    <Box>
      <Button ref={ref} onClick={() => setOpen(true)}>Open Panel</Button>
      <NotificationPanel
        anchorEl={ref.current}
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        onMarkAllRead={() => {}}
        onItemClick={() => {}}
      />
    </Box>
  );
};

const meta: Meta<typeof NotificationPanel> = {
  title: 'Notifications/NotificationPanel',
  component: NotificationPanel,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof NotificationPanel>;

export const Empty: Story = {
  render: () => <PanelWrapper items={[]} />,
};

export const CommentsOnly: Story = {
  render: () => <PanelWrapper items={mockItems} />,
};

export const WithLeaderChange: Story = {
  render: () => <PanelWrapper items={[leaderItem, ...mockItems]} />,
};

export const AllRead: Story = {
  render: () => <PanelWrapper items={mockItems.map(i => ({ ...i, read: true }))} />,
};
