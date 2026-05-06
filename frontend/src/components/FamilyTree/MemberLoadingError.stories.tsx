import { fn } from 'storybook/test';

import MemberLoadingError from './MemberLoadingError';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof MemberLoadingError> = {
  title: 'FamilyTree/MemberLoadingError',
  component: MemberLoadingError,
  parameters: { layout: 'padded' },
  args: {
    message: 'Network request failed. Please try again.',
    onRetry: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof MemberLoadingError>;

export const Default: Story = {};

export const LongMessage: Story = {
  args: {
    message: 'We were unable to load family members because the server is currently unreachable. This may be a temporary issue.',
  },
};
