import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StoryProviders } from '../../test/storyContexts';
import UserTimeline from './UserTimeline';

const meta: Meta<typeof UserTimeline> = {
  title: 'Profile/UserTimeline',
  component: UserTimeline,
  parameters: { layout: 'padded' },
  args: {
    userId: 'alice',
    onUserClick: fn(),
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
type Story = StoryObj<typeof UserTimeline>;

export const Default: Story = {};
