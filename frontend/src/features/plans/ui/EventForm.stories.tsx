import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EventFormView } from './EventForm';
import { birthday, circles, day } from './eventMocks';

const meta: Meta<typeof EventFormView> = {
  title: 'Home/EventForm',
  component: EventFormView,
  args: {
    open: true,
    date: day(3),
    circles,
    canSetAudience: true,
    onSave: fn(async () => undefined),
    onClose: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof EventFormView>;

/** A new event: for everyone here unless you choose. */
export const NewEvent: Story = {
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(await page.findByLabelText('What'), 'Gymnastics');
    await userEvent.click(page.getByLabelText('Repeats every week'));
    await userEvent.click(page.getByRole('button', { name: 'Tue' }));
    await userEvent.click(page.getByRole('button', { name: 'Thu' }));
    // Also for Erin, in the crew.
    await userEvent.click(page.getByLabelText('The Crew'));
    await userEvent.click(page.getByRole('button', { name: 'Erin' }));
    await userEvent.click(page.getByRole('button', { name: 'Share it' }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Gymnastics',
        start: day(3),
        weekly: { days: ['TU', 'TH'] },
        audience: [{ circleId: 'home' }, { circleId: 'crew', people: ['erin'] }],
      }),
    );
  },
};

/** Changing someone else's event as an admin: who it's for stays theirs. */
export const AsAdmin: Story = {
  args: { editing: birthday, canSetAudience: false },
};
