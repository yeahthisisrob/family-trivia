import { fn } from 'storybook/test';

import AddCelebrationDialog from './AddCelebrationDialog';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AddCelebrationDialog> = {
  title: 'UpcomingDates/AddCelebrationDialog',
  component: AddCelebrationDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onClose: fn(),
    onSuccess: fn(),
    currentUserId: 'alice',
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof AddCelebrationDialog>;

export const Default: Story = {};
