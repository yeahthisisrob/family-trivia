import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AvatarPicker } from './AvatarPicker';

// What the AI would draw, stood in by one of the bundled animals.
const made = { key: 'media/avatars/alice/0', url: '/avatars/animals/fox.svg', left: 2 };

const meta: Meta<typeof AvatarPicker> = {
  title: 'Profile/AvatarPicker',
  component: AvatarPicker,
  args: {
    personId: 'alice',
    name: 'Alice',
    onClose: fn(),
    save: fn(async () => undefined),
    make: fn(async () => made),
  },
};
export default meta;
type Story = StoryObj<typeof AvatarPicker>;

/** Opening it makes one for you; you can steer another, or pick an animal and its color. */
export const MadeForYou: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(args.make).toHaveBeenCalledTimes(1);
    await expect(await body.findByText('2 more today')).toBeInTheDocument();
    await userEvent.click(body.getByLabelText('owl'));
    // Then its color, as a second step.
    await userEvent.click(await body.findByLabelText('mint'));
    await userEvent.click(body.getByText('Use this one'));
    await expect(args.save).toHaveBeenCalledWith({
      library: 'animal',
      animal: 'owl',
      color: 'mint',
    });
  },
};

/** Someone who already chose an animal: it's selected, and nothing is made. */
export const AlreadyChosen: Story = {
  args: { current: { library: 'animal', animal: 'panda', color: 'peach' } },
  play: async ({ args }) => {
    await expect(args.make).not.toHaveBeenCalled();
  },
};
