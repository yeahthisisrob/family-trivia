import { fn } from 'storybook/test';

import CommentsTimeline from './CommentsTimeline';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CommentsTimeline> = {
  title: 'TimelineBoard/CommentsTimeline',
  component: CommentsTimeline,
  parameters: { layout: 'padded' },
  args: {
    mergedItems: [],
    currentUserId: 'alice',
    onUserClick: fn(),
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof CommentsTimeline>;

export const Empty: Story = {};
