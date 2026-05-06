import { LoadingScreen } from './LoadingScreen';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof LoadingScreen> = {
  title: 'Feedback/LoadingScreen',
  component: LoadingScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
  },
};
export default meta;
type Story = StoryObj<typeof LoadingScreen>;

export const Default: Story = {};

export const WithMessage: Story = {
  args: { message: 'Loading your family data...' },
};

export const LongMessage: Story = {
  args: { message: 'Getting everything ready — questions, facts, and scores...' },
};
