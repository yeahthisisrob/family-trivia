import { Typography } from '@mui/material';
import React from 'react';
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';

import ConfirmDialog from './ConfirmDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Admin/ConfirmDialog',
  component: ConfirmDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shared confirmation dialog for destructive actions (delete, reset). Always uses a red "Delete" confirm button by default — override `confirmLabel` for other actions.',
      },
    },
  },
  args: {
    open: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const Default: Story = {
  args: {
    title: 'Delete User',
    message: 'Are you sure you want to delete alice? This removes their profile, answers, and facts.',
  },
  play: async () => {
    await expect(screen.getByText('Delete User')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: /^Delete$/ });
    await expect(confirm).toBeInTheDocument();
  },
};

export const CustomLabel: Story = {
  args: {
    title: 'Reset Season',
    message: 'Resetting the season clears all scores and rounds. This cannot be undone.',
    confirmLabel: 'Reset',
  },
  play: async () => {
    await expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  },
};

export const RichMessage: Story = {
  args: {
    title: 'Delete 3 Entries',
    message: (
      <>
        <Typography variant="body2" sx={{ mb: 1 }}>
          You&apos;re about to delete <strong>3 fact entries</strong>:
        </Typography>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem' }}>
          <li>2026-04-05 · shared · scary movie</li>
          <li>2026-04-04 · shared · vacation</li>
          <li>2026-04-03 · basic · possession</li>
        </ul>
      </>
    ),
  },
};

export const ClickCancelFiresOnCancel: Story = {
  args: {
    title: 'Delete Item',
    message: 'Delete this item?',
  },
  play: async ({ args }) => {
    const cancel = screen.getByRole('button', { name: /Cancel/i });
    await userEvent.click(cancel);
    await expect(args.onCancel).toHaveBeenCalled();
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

export const ClickConfirmFiresOnConfirm: Story = {
  args: {
    title: 'Delete Item',
    message: 'Delete this item?',
  },
  play: async ({ args }) => {
    const confirm = screen.getByRole('button', { name: /^Delete$/ });
    await userEvent.click(confirm);
    await waitFor(async () => {
      await expect(args.onConfirm).toHaveBeenCalled();
    });
  },
};

export const Closed: Story = {
  args: {
    open: false,
    title: 'Hidden',
    message: 'This should not be visible.',
  },
  play: async () => {
    await expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  },
};
