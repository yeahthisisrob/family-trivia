import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import { EventDialog, EventDialogView } from './EventDialog';
import { birthdayView, day, gymnasticsView, nameOf } from './eventMocks';

const meta: Meta<typeof EventDialogView> = {
  title: 'Events/EventDialog',
  component: EventDialogView,
  args: {
    open: true,
    me: 'alice',
    nameOf,
    view: birthdayView,
    onClose: fn(),
    onRsvp: fn(async () => undefined),
    onEdit: fn(),
    onCancel: fn(async () => undefined),
    onSkip: fn(async () => undefined),
    onAddToCalendar: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof EventDialogView>;

/** Someone else's event: when and where, who's coming and with how many, and your answer. */
export const SomeonesEvent: Story = {
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText('Bringing the twins')).toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Going' }));
    await expect(args.onRsvp).toHaveBeenCalledWith({
      answer: 'in',
      guests: 0,
      note: 'Might be late',
    });
    await userEvent.click(page.getByRole('button', { name: 'Add to calendar' }));
    await expect(args.onAddToCalendar).toHaveBeenCalled();
  },
};

/** Your own repeating event, shared with another circle: edit, skip a day, or cancel it. */
export const YourRepeatingEvent: Story = {
  args: { view: gymnasticsView, day: day(1) },
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText(/The Crew: 1 going/)).toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Cancel event' }));
    await userEvent.click(page.getByRole('button', { name: 'Yes, cancel it' }));
    await expect(args.onCancel).toHaveBeenCalled();
  },
};

/** Cancelled: crossed out, and no more answers. */
export const Cancelled: Story = {
  args: { view: { ...birthdayView, event: { ...birthdayView.event, cancelled: true } } },
};

/** Loading. */
export const Loading: Story = { args: { view: undefined } };

/** From the server, with its comments. */
export const FromTheServer: StoryObj<typeof EventDialog> = {
  render: () => (
    <StoryProviders>
      <EventDialog id="carol-bday" me="alice" nameOf={nameOf} onClose={fn()} onEdit={fn()} />
    </StoryProviders>
  ),
  parameters: {
    msw: {
      handlers: [
        http.get('*/plans/events', () =>
          HttpResponse.json({ ok: true, data: { event: birthdayView } }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("Dave's birthday dinner")).toBeInTheDocument();
  },
};

/** In dark mode. */
export const SomeonesEventDark: Story = { globals: { scheme: 'dark' } };
