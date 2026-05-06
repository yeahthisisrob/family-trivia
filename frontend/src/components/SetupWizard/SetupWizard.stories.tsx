import { fn } from 'storybook/test';

import SetupWizard from './SetupWizard';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SetupWizard> = {
  title: 'SetupWizard/SetupWizard',
  component: SetupWizard,
  parameters: { layout: 'padded' },
  args: { onComplete: fn() },
};
export default meta;
type Story = StoryObj<typeof SetupWizard>;

export const Default: Story = {};
