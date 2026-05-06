import { fn } from 'storybook/test';

import CreateCustomCategoryButton from './CreateCustomCategoryButton';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CreateCustomCategoryButton> = {
  title: 'Common/CreateCustomCategoryButton',
  component: CreateCustomCategoryButton,
  parameters: { layout: 'centered' },
  args: { onCreateCustomCategory: fn() },
};
export default meta;
type Story = StoryObj<typeof CreateCustomCategoryButton>;

export const Default: Story = {};

export const Outlined: Story = {
  args: { variant: 'outlined' },
};

export const AddIcon: Story = {
  args: { icon: 'add' },
};

export const Large: Story = {
  args: { size: 'large', label: 'Create Your Own Category' },
};

export const NoContainer: Story = {
  args: { withContainer: false },
};
