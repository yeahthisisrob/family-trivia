import { fn } from 'storybook/test';

import UserTimeline from './UserTimeline';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof UserTimeline> = {
  title: 'Profile/UserTimeline',
  component: UserTimeline,
  parameters: { layout: 'padded' },
  args: {
    userId: 'alice',
    onUserClick: fn(),
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof UserTimeline>;

export const Default: Story = {};
