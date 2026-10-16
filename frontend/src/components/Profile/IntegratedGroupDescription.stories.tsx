import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryProviders } from '../../test/storyContexts';
import IntegratedGroupDescription from './IntegratedGroupDescription';

const meta: Meta<typeof IntegratedGroupDescription> = {
  title: 'Profile/IntegratedGroupDescription',
  component: IntegratedGroupDescription,
  parameters: { layout: 'padded' },
  args: {
    userId: 'alice',
    isCurrentUser: true,
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof IntegratedGroupDescription>;

export const CurrentUser: Story = {};

export const OtherUser: Story = {
  args: { isCurrentUser: false },
};
