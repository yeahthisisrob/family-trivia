import { fn } from 'storybook/test';

import { ErrorScreen } from './ErrorScreen';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ErrorScreen> = {
  title: 'Feedback/ErrorScreen',
  component: ErrorScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    message: 'We could not connect to the server. Please check your connection and try again.',
    onRetry: fn(),
    open: true,
  },
};
export default meta;
type Story = StoryObj<typeof ErrorScreen>;

export const Default: Story = {};

export const CustomTitle: Story = {
  args: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred while loading your data.',
  },
};

export const CustomButton: Story = {
  args: {
    title: 'Offline',
    message: 'You appear to be offline.',
    buttonText: 'Reconnect',
  },
};
