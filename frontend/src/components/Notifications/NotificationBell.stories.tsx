import { Box } from '@mui/material';
import React from 'react';

import NotificationBell from './NotificationBell';
import { NotificationProvider } from '../../contexts/NotificationContext';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof NotificationBell> = {
  title: 'Notifications/NotificationBell',
  component: NotificationBell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Bell icon with unread badge. Click to open notification panel. ' +
          'Uses MSW to mock /notifications endpoint with different states.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NotificationProvider userId="alice">
        <Box sx={{ bgcolor: '#2e7d32', p: 2, borderRadius: 2 }}>
          <Story />
        </Box>
      </NotificationProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof NotificationBell>;

/** Default: shows unread comment notifications from MSW mock */
export const WithUnread: Story = {};

/** Click the bell to see the notification panel */
export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Click the bell icon to open the notification panel with mock data.',
      },
    },
  },
};
