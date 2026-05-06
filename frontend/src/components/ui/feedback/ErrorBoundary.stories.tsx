import { Typography } from '@mui/material';
import React from 'react';
import { expect, userEvent, within } from 'storybook/test';

import ErrorBoundary from './ErrorBoundary';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Functional wrapper so Storybook can infer props cleanly (React class
// component types collide with the addon's own React types).
const ErrorBoundaryWrapper: React.FC<{
  label?: string;
  children: React.ReactNode;
}> = (props) => <ErrorBoundary {...props} />;

const meta: Meta<typeof ErrorBoundaryWrapper> = {
  title: 'Feedback/ErrorBoundary',
  component: ErrorBoundaryWrapper,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wraps a subtree. If a child throws during render, catches the error, logs it, and shows a minimal fallback with a "Try again" reset button. Prevents one crash from killing the entire tab.',
      },
    },
  },
  decorators: [
    (Story) => <div style={{ maxWidth: 480 }}><Story /></div>,
  ],
};
export default meta;
type Story = StoryObj<typeof ErrorBoundaryWrapper>;

const Boom: React.FC<{ msg?: string }> = ({ msg = 'Kaboom' }) => {
  throw new Error(msg);
};

const BoomOnClick: React.FC = () => {
  const [crashed, setCrashed] = React.useState(false);
  if (crashed) throw new Error('User-triggered crash');
  return (
    <button onClick={() => setCrashed(true)} data-testid="crash-btn">
      Click to crash
    </button>
  );
};

export const HealthyChild: Story = {
  args: {
    label: 'the safe zone',
    children: <Typography sx={{ fontSize: '0.85rem' }}>All good — no errors.</Typography>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/All good/)).toBeInTheDocument();
  },
};

export const CaughtError: Story = {
  args: {
    label: 'demo subtree',
    children: <Boom msg="Test crash" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Something broke in demo subtree/)).toBeInTheDocument();
    await expect(canvas.getByText('Test crash')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  },
};

export const ResetClears: Story = {
  args: {
    label: 'reset demo',
    children: <BoomOnClick />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByTestId('crash-btn');
    await userEvent.click(btn);
    await expect(canvas.getByText(/Something broke/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /Try again/i }));
    await expect(canvas.getByTestId('crash-btn')).toBeInTheDocument();
  },
};

export const DefaultLabel: Story = {
  args: {
    children: <Boom msg="No label crash" />,
  },
  parameters: {
    docs: { description: { story: 'Without `label`, shows "this section" as the fallback name.' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Something broke in this section/)).toBeInTheDocument();
  },
};
