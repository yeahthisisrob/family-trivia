import AddIcon from '@mui/icons-material/Add';
import InboxIcon from '@mui/icons-material/Inbox';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import { Button } from '@mui/material';
import React from 'react';
import { expect, within } from 'storybook/test';

import EmptyState from './EmptyState';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof EmptyState> = {
  title: 'Admin/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shown when a list has no items. Supports an optional icon and action button. Keep copy short and actionable.',
      },
    },
  },
  decorators: [
    (Story) => <div style={{ maxWidth: 480 }}><Story /></div>,
  ],
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const MessageOnly: Story = {
  args: { message: 'Select a player to view their data' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Select a player to view their data')).toBeInTheDocument();
  },
};

export const WithIcon: Story = {
  args: {
    icon: <InboxIcon fontSize="inherit" />,
    message: 'No facts found for this player',
  },
};

export const WithAction: Story = {
  args: {
    icon: <PersonOffIcon fontSize="inherit" />,
    message: 'No players have joined yet',
    action: (
      <Button size="small" variant="outlined" startIcon={<AddIcon />}>
        Invite a player
      </Button>
    ),
  },
};
