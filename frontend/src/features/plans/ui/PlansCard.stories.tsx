import { addDays, type Drop, getTodayET, plansView } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PlansCard, PlansCardView } from './PlansCard';

const today = getTodayET();
const day = (n: number) => addDays(today, n);
const names: Record<string, string> = { alice: 'Alice', bob: 'Bob', carol: 'Carol', dave: 'Dave' };
const nameOf = (id: string) => names[id] ?? id;

const drop = (d: Partial<Drop> & Pick<Drop, 'id' | 'by' | 'kind' | 'title' | 'start'>): Drop => ({
  createdAt: today,
  ...d,
});
// A made-up circle's next weeks (never a real one: docs/decisions/0006).
const drops: Drop[] = [
  drop({ id: 'bob-1', by: 'bob', kind: 'busy', title: 'Work trip', start: day(1), end: day(3) }),
  drop({ id: 'carol-1', by: 'carol', kind: 'plan', title: 'Hike at the falls', start: day(5) }),
  drop({ id: 'dave-1', by: 'dave', kind: 'free', title: 'Free all day', start: day(5) }),
  drop({ id: 'alice-1', by: 'alice', kind: 'busy', title: 'Choir', start: day(2), weekly: {} }),
  drop({
    id: 'dave-2',
    by: 'dave',
    kind: 'plan',
    title: 'Game night',
    start: day(9),
    part: 'evening',
  }),
];
const view = plansView(
  'alice',
  Object.keys(names),
  drops,
  { 'carol-1': { bob: 'in', dave: 'in' } },
  today,
  addDays(today, 55),
);

const meta: Meta<typeof PlansCardView> = {
  title: 'Home/PlansCard',
  component: PlansCardView,
  args: {
    me: 'alice',
    nameOf,
    view,
    onDropIn: fn(async () => []),
    onRemove: fn(async () => undefined),
    onRsvp: fn(async () => undefined),
  },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof PlansCardView>;

/** The next two weeks; the best day is picked to start. */
export const TheWeeksAhead: Story = {};

/** Nothing on yet: the box is the whole ask. */
export const NothingYet: Story = {
  args: { view: plansView('alice', Object.keys(names), [], {}, today, addDays(today, 55)) },
};

/** Drop in a few words; it comes back as days, and an x takes it back. */
export const DropIn: StoryObj<typeof PlansCard> = {
  render: () => <PlansCard me="alice" nameOf={nameOf} />,
  parameters: {
    msw: {
      handlers: [
        http.get('*/plans', () => HttpResponse.json({ ok: true, data: view })),
        http.post('*/plans', () =>
          HttpResponse.json({
            ok: true,
            data: {
              added: [
                drop({
                  id: 'alice-2',
                  by: 'alice',
                  kind: 'busy',
                  title: 'Beach weekend',
                  start: day(12),
                  end: day(13),
                }),
              ],
            },
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("What you're doing"), 'beach weekend');
    await userEvent.click(canvas.getByLabelText('Drop it in'));
    await expect(await canvas.findByText(/Beach weekend ·/)).toBeInTheDocument();
  },
};
