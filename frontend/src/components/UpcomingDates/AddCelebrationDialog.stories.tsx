import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StoryProviders } from '../../test/storyContexts';
import AddCelebrationDialog from './AddCelebrationDialog';

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
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof AddCelebrationDialog>;

export const Default: Story = {};
