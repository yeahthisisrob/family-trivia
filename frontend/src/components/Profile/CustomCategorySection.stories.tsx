import { fn } from 'storybook/test';

import CustomCategorySection from './CustomCategorySection';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CustomCategorySection> = {
  title: 'Profile/CustomCategorySection',
  component: CustomCategorySection,
  parameters: { layout: 'padded' },
  args: {
    isCurrentUser: true,
    onCreateCategory: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof CustomCategorySection>;

export const WithCategory: Story = {
  args: {
    customCategory: {
      id: 'cat_1',
      type: 'custom',
      title: 'Wilderness Survival Trivia',
      description: 'Questions about outdoor survival skills.',
      createdBy: 'alice',
      createdAt: '2026-04-01T00:00:00.000Z',
    },
  },
};

export const Empty: Story = {
  args: { customCategory: null },
};

export const OtherUser: Story = {
  args: {
    customCategory: {
      id: 'cat_2',
      type: 'custom',
      title: "Dad's Movie Trivia",
      description: 'Classic films from the 70s and 80s.',
      createdBy: 'bob',
      createdAt: '2026-04-01T00:00:00.000Z',
    },
    isCurrentUser: false,
  },
};
