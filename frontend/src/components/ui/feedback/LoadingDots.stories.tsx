import React from 'react';
import { expect, within } from 'storybook/test';

import LoadingDots from './LoadingDots';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof LoadingDots> = {
  title: 'Feedback/LoadingDots',
  component: LoadingDots,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Three-dot loading indicator with two animation modes: `wave` (default) for standalone loading states, and `pulse` (inline) for use inside buttons or next to text.',
      },
    },
  },
  argTypes: {
    size: { control: { type: 'range', min: 4, max: 24, step: 1 } },
    gap: { control: { type: 'range', min: 0, max: 20, step: 1 } },
    mt: { control: { type: 'number' } },
    color: { control: 'color' },
    inline: { control: 'boolean' },
    center: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof LoadingDots>;

export const Default: Story = {
  args: { size: 8 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 3 dots rendered
    const dots = canvas.getAllByRole('generic').filter(el =>
      getComputedStyle(el).borderRadius === '50%',
    );
    await expect(dots.length).toBeGreaterThanOrEqual(3);
  },
};

export const Small: Story = { args: { size: 5 } };
export const Large: Story = { args: { size: 16 } };

export const Inline: Story = {
  args: { inline: true, size: 6 },
  render: (args) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
      Loading<LoadingDots {...args} />
    </span>
  ),
};

export const CustomColor: Story = {
  args: { size: 10, color: '#ff6b6b' },
};

export const InButton: Story = {
  args: { inline: true, size: 5 },
  render: (args) => (
    <button
      disabled
      style={{
        padding: '10px 20px',
        borderRadius: 8,
        border: 'none',
        background: '#2e7d32',
        color: 'white',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      Submitting<LoadingDots {...args} />
    </button>
  ),
};
