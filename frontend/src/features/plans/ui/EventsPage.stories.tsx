import { addDays, getTodayET, plansView } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EventsPage, EventsPageView } from './EventsPage';
import { birthday, day, gymnasticsView, nameOf } from './eventMocks';

const today = getTodayET();
// A made-up circle's weeks ahead (docs/decisions/0006): two events and a drop-in.
const view = plansView(
  'alice',
  ['alice', 'bob', 'carol', 'dave'],
  [
    birthday,
    { ...gymnasticsView.event, from: { circleId: 'crew', name: 'The Crew' } },
    { id: 'bob-1', by: 'bob', kind: 'busy', title: 'Work trip', start: day(2), createdAt: today },
  ],
  {
    [birthday.id]: {
      bob: { answer: 'in', guests: 2, at: today },
      alice: { answer: 'maybe', at: today },
    },
  },
  today,
  addDays(today, 55),
);

const meta: Meta<typeof EventsPageView> = {
  title: 'Events/EventsPage',
  component: EventsPageView,
  args: { me: 'alice', nameOf, view, onOpen: fn(), onNew: fn() },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof EventsPageView>;

/** What's coming up, soonest first; tap one for its page. */
export const ComingUp: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cards = await canvas.findAllByRole('button', { name: /, details$/ });
    await expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Gymnastics, details',
      "Dave's birthday dinner, details",
    ]);
    await userEvent.click(cards[1] as HTMLElement);
    await expect(args.onOpen).toHaveBeenCalledWith(birthday.id, birthday.start);
  },
};

/** Nothing yet: the button is the whole ask. */
export const NothingYet: Story = {
  args: { view: plansView('alice', ['alice'], [], {}, today, addDays(today, 55)) },
};

/** From the server. */
export const FromTheServer: StoryObj<typeof EventsPage> = {
  render: () => <EventsPage me="alice" nameOf={nameOf} />,
  parameters: {
    msw: { handlers: [http.get('*/plans', () => HttpResponse.json({ ok: true, data: view }))] },
  },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Gymnastics')).toBeInTheDocument();
  },
};
