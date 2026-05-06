import { fn } from 'storybook/test';

import TriviaTimeline from './TriviaTimeline';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TriviaTimeline> = {
  title: 'TimelineBoard/TriviaTimeline',
  component: TriviaTimeline,
  parameters: { layout: 'padded' },
  args: {
    currentUserId: 'alice',
    onUserClick: fn(),
    selectedSide: 'all',
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof TriviaTimeline>;

export const Default: Story = {};
