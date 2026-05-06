import FactComments from './FactComments';
import { StoryProviders } from '../../test/storyContexts';
import { getUserColor, getUserInitials } from '../../utils';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FactComments> = {
  title: 'TimelineBoard/FactComments',
  component: FactComments,
  parameters: { layout: 'padded' },
  args: {
    factId: 'alice_2026-04-10T14:30:00.000Z',
    currentUserId: 'alice',
    getUserColor,
    getUserInitials,
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof FactComments>;

export const Default: Story = {};
