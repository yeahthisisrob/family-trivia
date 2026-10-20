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
  },
};

/** One circle: nothing to see across yet. */
export const OneCircle: Story = {
  args: { world: { ...world, enough: false, nodes: [], links: [], threads: [], meet: [] } },
};
