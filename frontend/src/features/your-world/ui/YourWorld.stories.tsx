import type { WorldView } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { YourWorldView } from './YourWorld';

// A made-up family and crew, with Alice in both (never real people: docs/decisions/0006).
const world: WorldView = {
  circles: [
    { id: 'home', name: 'The Smiths', kind: 'family' },
    { id: 'crew', name: 'The Crew', kind: 'friends' },
  ],
  enough: true,
  nodes: [
    {
      id: 'home:alice',
      circleId: 'home',
      personId: 'alice',
      name: 'Alice',
      me: true,
      bridge: true,
    },
    { id: 'home:bob', circleId: 'home', personId: 'bob', name: 'Bob' },
    { id: 'home:carol', circleId: 'home', personId: 'carol', name: 'Carol' },
    { id: 'crew:al', circleId: 'crew', personId: 'al', name: 'Al', me: true, bridge: true },
    { id: 'crew:dee', circleId: 'crew', personId: 'dee', name: 'Dee' },
    { id: 'crew:eli', circleId: 'crew', personId: 'eli', name: 'Eli' },
  ],
  links: [
    { a: 'home:alice', b: 'home:bob', kind: 'tie' },
    { a: 'home:bob', b: 'home:carol', kind: 'tie' },
    { a: 'crew:al', b: 'crew:dee', kind: 'tie' },
    { a: 'crew:dee', b: 'crew:eli', kind: 'tie' },
    { a: 'home:alice', b: 'crew:al', kind: 'same' },
  ],
  threads: [{ name: 'the beach', kind: 'place', people: ['home:bob', 'crew:dee'] }],
  meet: [{ a: 'home:bob', b: 'crew:dee', because: 'the beach' }],
  timeline: [
    {
      date: '1988-04-02',
      kind: 'born',
      title: 'You were born',
      detail: 'in Springfield',
      circleId: 'home',
    },
    {
      date: '2009',
      kind: 'met',
      title: 'You met Dee',
      detail: 'at college, in Springfield',
      circleId: 'crew',
    },
    { date: '2014-06-21', kind: 'partner', title: 'You and Bob got married', circleId: 'home' },
    { date: '2017', kind: 'remembered', title: 'Sam died', circleId: 'crew' },
    { date: '2026-03-02', kind: 'joined', title: 'You joined The Smiths', circleId: 'home' },
    {
      date: '2026-09-06',
      kind: 'plan',
      title: 'Hike at Blue Hills, with Dee',
      detail: 'Dee: “Best hike of the year”',
      circleId: 'crew',
    },
  ],
};

const meta: Meta<typeof YourWorldView> = {
  title: 'Circles/YourWorld',
  component: YourWorldView,
  args: { world, onClose: fn() },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof YourWorldView>;

/** A family and a crew, you in both, and what they share. */
export const TwoCircles: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Who should meet')).toBeInTheDocument();
    await expect(body.getByText('Your story so far')).toBeInTheDocument();
    await expect(body.getByText('2009')).toBeInTheDocument();
    await expect(body.getByText('at college, in Springfield')).toBeInTheDocument();
  },
};

/** One circle: nothing to see across yet. */
export const OneCircle: Story = {
  args: {
    world: { ...world, enough: false, nodes: [], links: [], threads: [], meet: [], timeline: [] },
  },
};
