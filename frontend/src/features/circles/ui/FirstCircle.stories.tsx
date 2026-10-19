import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FirstCircle } from './FirstCircle';

const meta: Meta<typeof FirstCircle> = {
  title: 'Circles/FirstCircle',
  component: FirstCircle,
  args: { yourName: 'Alice', onStart: fn(async () => undefined) },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof FirstCircle>;

/** The first sign-in on a new deployment: name it, pick who it's for, and you're in. */
export const StartYourCircle: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'The Smiths');
    await userEvent.click(canvas.getByText('Start it'));
    await expect(args.onStart).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'The Smiths', kind: 'family', yourName: 'Alice' }),
    );
  },
};
