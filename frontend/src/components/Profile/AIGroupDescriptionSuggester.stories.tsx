import { fn } from 'storybook/test';

import AIGroupDescriptionSuggester from './AIGroupDescriptionSuggester';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AIGroupDescriptionSuggester> = {
  title: 'Profile/AIGroupDescriptionSuggester',
  component: AIGroupDescriptionSuggester,
  parameters: { layout: 'centered' },
  args: {
    userId: 'alice',
    open: true,
    onClose: fn(),
    onAccept: fn(),
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof AIGroupDescriptionSuggester>;

export const Default: Story = {};
