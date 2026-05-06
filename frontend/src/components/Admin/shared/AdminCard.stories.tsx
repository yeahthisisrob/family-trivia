import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Chip, IconButton, Typography } from '@mui/material';
import React from 'react';
import { expect, within } from 'storybook/test';

import AdminCard from './AdminCard';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AdminCard> = {
  title: 'Admin/AdminCard',
  component: AdminCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Reusable card wrapper for admin panel content. Supports title + badge + actions in the header, with children as the body. Uses design system tokens (radii.lg, shadows.card) for consistency.',
      },
    },
  },
  decorators: [
    (Story) => <div style={{ maxWidth: 480 }}><Story /></div>,
  ],
};
export default meta;
type Story = StoryObj<typeof AdminCard>;

export const Default: Story = {
  args: {
    title: 'Settings',
    children: <Typography sx={{ fontSize: '0.85rem' }}>Card body content</Typography>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Settings')).toBeInTheDocument();
    await expect(canvas.getByText('Card body content')).toBeInTheDocument();
  },
};

export const WithBadge: Story = {
  args: {
    title: 'Active Season',
    badge: <Chip label="active" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />,
    children: <Typography sx={{ fontSize: '0.85rem' }}>Season 1 · Running since 2026-03-06</Typography>,
  },
};

export const WithActions: Story = {
  args: {
    title: 'User: alice',
    actions: (
      <>
        <IconButton size="small"><EditIcon sx={{ fontSize: 16 }} /></IconButton>
        <IconButton size="small" color="error"><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
      </>
    ),
    children: <Typography sx={{ fontSize: '0.85rem' }}>Last seen today</Typography>,
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'Rob',
    subtitle: 'group-a',
    badge: <Chip label="admin" size="small" color="primary" sx={{ height: 20, fontSize: '0.6rem' }} />,
    children: <Typography sx={{ fontSize: '0.85rem' }}>4 activations · 2 questions today</Typography>,
  },
};

export const Highlighted: Story = {
  args: {
    highlighted: true,
    title: 'Current Round',
    badge: <Chip label="in-progress" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />,
    actions: <IconButton size="small"><CheckIcon sx={{ fontSize: 16 }} /></IconButton>,
    children: (
      <>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Round 3 — Rob guessing about Alice</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
          Started 2m ago · 2 guesses
        </Typography>
      </>
    ),
  },
  parameters: {
    docs: { description: { story: 'Highlighted variant has a primary-color left border accent and elevated shadow.' } },
  },
};

export const BodyOnly: Story = {
  args: {
    children: (
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
        Card with no header — just body content.
      </Typography>
    ),
  },
  parameters: {
    docs: { description: { story: 'When no title or actions are passed, the header is omitted entirely.' } },
  },
};
