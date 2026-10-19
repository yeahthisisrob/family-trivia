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

/** Initials until you pick: nine to choose from in each style. */
export const ChooseOne: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByText('Doodle'));
    await userEvent.click(body.getByLabelText('Picture 4'));
    await userEvent.click(body.getByText('Use this one'));
    await expect(args.save).toHaveBeenCalledWith({
      library: 'dicebear',
      style: 'notionists',
      seed: 'alice-notionists-4',
    });
  },
};

/** Someone who already chose: their picture is selected. */
export const AlreadyChosen: Story = {
  args: { current: { library: 'dicebear', style: 'open-peeps', seed: 'alice-open-peeps-2' } },
};
