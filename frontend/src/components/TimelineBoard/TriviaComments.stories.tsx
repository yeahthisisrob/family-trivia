import TriviaComments from './TriviaComments';
import { StoryProviders } from '../../test/storyContexts';
import { getUserColor, getUserInitials } from '../../utils';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TriviaComments> = {
  title: 'TimelineBoard/TriviaComments',
  component: TriviaComments,
  parameters: { layout: 'padded' },
  args: {
    triviaId: 'alice_2026-04-10T14:30:00.000Z',
    currentUserId: 'alice',
    getUserColor,
    getUserInitials,
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof TriviaComments>;

export const Default: Story = {};
