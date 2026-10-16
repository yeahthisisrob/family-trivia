import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StoryProviders } from '../../test/storyContexts';
import CommentsTimeline from './CommentsTimeline';

const meta: Meta<typeof CommentsTimeline> = {
  title: 'TimelineBoard/CommentsTimeline',
  component: CommentsTimeline,
  parameters: { layout: 'padded' },
  args: {
    mergedItems: [],
    currentUserId: 'alice',
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
type Story = StoryObj<typeof CommentsTimeline>;

export const Empty: Story = {};
