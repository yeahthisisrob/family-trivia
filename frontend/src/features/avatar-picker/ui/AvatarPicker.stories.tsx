import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AvatarPicker } from './AvatarPicker';

const meta: Meta<typeof AvatarPicker> = {
  title: 'Profile/AvatarPicker',
  component: AvatarPicker,
  args: { personId: 'alice', name: 'Alice', onClose: fn(), save: fn(async () => undefined) },
};
export default meta;
type Story = StoryObj<typeof AvatarPicker>;

/** Initials until you pick: a style, one of nine, then a skin tone. */
export const ChooseOne: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByText('Toon'));
    await userEvent.click(body.getByLabelText('Picture 4'));
    // Then the tone, as a second step under the picked picture.
    await userEvent.click(await body.findByLabelText('medium'));
    await userEvent.click(body.getByText('Use this one'));
    await expect(args.save).toHaveBeenCalledWith({
      library: 'dicebear',
      style: 'toon-head',
      seed: 'alice-toon-head-4',
      tone: 'medium',
    });
  },
};

/** Someone who already chose: their picture is selected. */
export const AlreadyChosen: Story = {
  args: { current: { library: 'dicebear', style: 'micah', seed: 'alice-micah-2', tone: 'light' } },
};
