import CustomCategoryBanner from './CustomCategoryBanner';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CustomCategoryBanner> = {
  title: 'TimelineBoard/CustomCategoryBanner',
  component: CustomCategoryBanner,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof CustomCategoryBanner>;

export const Default: Story = {};
export const CustomText: Story = { args: { text: 'SPECIAL TOPIC' } };
