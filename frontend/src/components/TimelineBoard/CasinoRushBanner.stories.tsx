import CasinoRushBanner from './CasinoRushBanner';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CasinoRushBanner> = {
  title: 'TimelineBoard/CasinoRushBanner',
  component: CasinoRushBanner,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof CasinoRushBanner>;

export const Completed: Story = { args: { failed: false } };
export const Failed: Story = { args: { failed: true } };
