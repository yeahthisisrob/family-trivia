import { fn } from 'storybook/test';

import FormFeedback from './FormFeedback';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FormFeedback> = {
  title: 'CustomCategoryForm/FormFeedback',
  component: FormFeedback,
  parameters: { layout: 'padded' },
  args: {
    message: 'Category created successfully.',
    onDismiss: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof FormFeedback>;

export const Info: Story = { args: { severity: 'info', message: 'Pick a theme to focus your custom category.' } };
export const Success: Story = { args: { severity: 'success', message: 'Category created successfully.' } };
export const Warning: Story = { args: { severity: 'warning', message: 'This category is very similar to an existing one.' } };
export const Error: Story = { args: { severity: 'error', message: 'Failed to save. Please try again.' } };
export const NoDismiss: Story = { args: { severity: 'info', message: 'This message cannot be dismissed.', onDismiss: undefined } };
