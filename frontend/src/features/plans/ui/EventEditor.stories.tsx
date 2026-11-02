import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EventEditorView } from './EventEditor';
import { birthday, circles, day } from './eventMocks';

const meta: Meta<typeof EventEditorView> = {
  title: 'Events/EventEditor',
  component: EventEditorView,
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
type Story = StoryObj<typeof EventEditorView>;

/** One sheet: what, when, weekly on chosen days, and who it's for as circles and people. */
export const NewEvent: Story = {
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(await page.findByLabelText('What is it?'), 'Gymnastics');
    await userEvent.click(page.getByRole('button', { name: /Weekly/ }));
    for (const d of ['Tue', 'Thu'])
      if (page.getByRole('button', { name: d }).getAttribute('aria-pressed') !== 'true')
        await userEvent.click(page.getByRole('button', { name: d }));
    // Also for Erin, in the crew.
    await userEvent.click(page.getByRole('button', { name: 'The Crew' }));
    await userEvent.click(page.getByRole('button', { name: 'Erin' }));
    await userEvent.click(page.getByRole('button', { name: 'Share it' }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Gymnastics',
        start: day(3),
        weekly: expect.objectContaining({ days: expect.arrayContaining(['TU', 'TH']) }),
        audience: [{ circleId: 'home' }, { circleId: 'crew', people: ['erin'] }],
      }),
    );
  },
};

/** The same sheet in dark mode. */
export const NewEventDark: Story = { globals: { scheme: 'dark' } };

/** Changing someone else's event as an admin: who it's for stays theirs. */
export const AsAdmin: Story = { args: { editing: birthday, canSetAudience: false } };
