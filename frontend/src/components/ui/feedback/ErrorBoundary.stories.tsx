import { Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { expect, userEvent, within } from 'storybook/test';
import ErrorBoundary from './ErrorBoundary';

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
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
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
    <button type="button" onClick={() => setCrashed(true)} data-testid="crash-btn">
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
    await expect(canvas.getByText("Demo subtree didn't load")).toBeInTheDocument();
    // The raw error goes to the log, not to the person.
    await expect(canvas.queryByText('Test crash')).toBeNull();
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
    await expect(canvas.getByText(/didn't load/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /Try again/i }));
    await expect(canvas.getByTestId('crash-btn')).toBeInTheDocument();
  },
};

export const DefaultLabel: Story = {
  args: {
    children: <Boom msg="No label crash" />,
  },
  parameters: {
    docs: { description: { story: 'Without `label`, it says "This section didn\'t load".' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("This section didn't load")).toBeInTheDocument();
  },
};

/** On Home: one card fails, says so quietly, and the cards around it carry on. */
export const OneCardOfMany: Story = {
  render: () => (
    <>
      <ErrorBoundary label="what's on">
        <Boom msg="days is undefined" />
      </ErrorBoundary>
      <Typography sx={{ mt: 1 }}>A memory a day</Typography>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("What's on didn't load")).toBeInTheDocument();
    await expect(canvas.getByText('A memory a day')).toBeInTheDocument();
  },
};
