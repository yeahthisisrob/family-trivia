import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ColorModeToggle } from './ColorModeToggle';

const meta: Meta<typeof ColorModeToggle> = {
  title: 'Design System/ColorModeToggle',
  component: ColorModeToggle,
};
export default meta;
type Story = StoryObj<typeof ColorModeToggle>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    const before = button.getAttribute('aria-label');
    await userEvent.click(button);
    await expect(button.getAttribute('aria-label')).not.toBe(before);
  },
};
