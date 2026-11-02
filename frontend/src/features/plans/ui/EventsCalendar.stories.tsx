import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import { EventsCalendar, EventsCalendarView } from './EventsCalendar';
import { birthday, day, monthOf, nameOf } from './eventMocks';

const today = day(0);
// The month the made-up birthday falls in, so the story holds on any day it runs.
const month = birthday.start.slice(0, 7);
const longDay = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const meta: Meta<typeof EventsCalendarView> = {
  title: 'Events/EventsCalendar',
  component: EventsCalendarView,
  args: {
    me: 'alice',
    nameOf,
    today,
    month,
    view: monthOf(month),
    onMonth: fn(),
    onOpen: fn(),
    onNew: fn(),
    onQuickAdd: fn(),
  },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof EventsCalendarView>;

/** The month on a phone: today circled, dots for each event, the day's events under the grid. */
export const Month: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const bday = canvas.getByRole('button', {
      name: new RegExp(`^${longDay(birthday.start)}, \\d+ event`),
    });
    await userEvent.click(bday);
    const page = within(canvasElement.ownerDocument.body);
    const rows = await page.findAllByRole('button', { name: "Dave's birthday dinner, details" });
    await userEvent.click(rows[0] as HTMLElement);
    await expect(args.onOpen).toHaveBeenCalledWith(birthday.id, birthday.start);
  },
};

/** The same month in dark mode. */
export const MonthDark: Story = { globals: { scheme: 'dark' } };

/** The month as an agenda: one card per day with something on, today always. */
export const List: Story = {
  args: { initialView: 'list' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect((await canvas.findAllByText('Gymnastics')).length).toBeGreaterThan(1);
    await expect(canvas.getByText(/Cancelled/)).toBeInTheDocument();
  },
};

/** The agenda in dark mode. */
export const ListDark: Story = { args: { initialView: 'list' }, globals: { scheme: 'dark' } };

/** On a wide screen the picked day sits above the grid, titles in each cell. */
export const Desktop: Story = { parameters: { viewport: { defaultViewport: 'responsive' } } };

/** Loading. */
export const Loading: Story = { args: { view: null } };

/** From the server, a month at a time. */
export const FromTheServer: StoryObj<typeof EventsCalendar> = {
  render: () => (
    <StoryProviders>
      <EventsCalendar me="alice" nameOf={nameOf} />
    </StoryProviders>
  ),
  parameters: {
    msw: {
      handlers: [
        http.get('*/plans', () =>
          HttpResponse.json({ ok: true, data: monthOf(today.slice(0, 7)) }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Next month' })).toBeInTheDocument();
  },
};
