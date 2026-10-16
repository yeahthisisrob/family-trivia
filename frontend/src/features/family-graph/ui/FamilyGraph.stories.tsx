import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { GraphData } from '../api/graphApi';
import { FamilyGraph } from './FamilyGraph';

// A made-up blended family (docs/decisions/0006).
const person = (id: string, name: string, extra: Partial<GraphData['people'][0]> = {}) => ({
  id,
  name,
  participation: 'playing' as const,
  remembered: false,
  died: null,
  activity: { facts: 20 + id.length * 7, trivia: 60 },
  ...extra,
});

const data: GraphData = {
  people: [
    person('grace', 'Grandma Grace', {
      participation: 'not-playing',
      remembered: true,
      died: '2024-03-01',
    }),
    person('nan', 'Nan'),
    person('alice', 'Alice'),
    person('bob', 'Bob'),
    person('erin', 'Erin'),
    person('hal', 'Hal', { participation: 'paused' }),
    person('carol', 'Carol'),
    person('dave', 'Dave'),
    person('frank', 'Frank'),
    person('ivy', 'Aunt Ivy'),
    person('jo', 'Jo'),
  ],
  ties: [
    {
      id: 'p1',
      type: 'partner',
      a: 'alice',
      b: 'bob',
      kind: 'married',
      ended: { reason: 'divorced' },
    },
    { id: 'p2', type: 'partner', a: 'bob', b: 'erin', kind: 'married' },
    { id: 'p3', type: 'partner', a: 'alice', b: 'hal', kind: 'partnered' },
    { id: 'c1', type: 'parent', parent: 'grace', child: 'bob', kind: 'birth' },
    { id: 'c2', type: 'parent', parent: 'nan', child: 'bob', kind: 'birth' },
    { id: 'c3', type: 'parent', parent: 'grace', child: 'ivy', kind: 'birth' },
    { id: 'c4', type: 'parent', parent: 'alice', child: 'carol', kind: 'birth' },
    { id: 'c5', type: 'parent', parent: 'bob', child: 'carol', kind: 'birth' },
    { id: 'c6', type: 'parent', parent: 'alice', child: 'dave', kind: 'birth' },
    { id: 'c7', type: 'parent', parent: 'bob', child: 'dave', kind: 'birth' },
    { id: 'c8', type: 'parent', parent: 'erin', child: 'frank', kind: 'birth' },
    { id: 'c9', type: 'parent', parent: 'ivy', child: 'jo', kind: 'birth' },
  ],
  households: [
    { id: 'mom', name: "Mom's house", members: ['alice', 'hal', 'carol', 'dave'] },
    { id: 'dad', name: "Dad's house", members: ['bob', 'erin', 'frank', 'carol', 'dave'] },
  ],
  likenesses: [
    {
      a: 'carol',
      b: 'grace',
      count: 9,
      strength: 0.4,
      examples: [
        {
          question: 'What always makes you smile?',
          a: 'Birds in the garden',
          b: 'The birds at the feeder',
        },
      ],
    },
    {
      a: 'carol',
      b: 'jo',
      count: 7,
      strength: 0.3,
      examples: [{ question: 'Happy place?', a: 'The beach', b: 'Beach with cousins' }],
    },
    {
      a: 'bob',
      b: 'ivy',
      count: 6,
      strength: 0.25,
      examples: [{ question: 'Comfort food?', a: "Mom's apple pie", b: 'Apple pie' }],
    },
    {
      a: 'dave',
      b: 'frank',
      count: 5,
      strength: 0.2,
      examples: [{ question: 'Best game?', a: 'Soccer', b: 'Soccer, always' }],
    },
    {
      a: 'alice',
      b: 'erin',
      count: 3,
      strength: 0.1,
      examples: [{ question: 'Dream trip?', a: 'Italy', b: 'Italy with friends' }],
    },
  ],
};

const meta: Meta<typeof FamilyGraph> = {
  title: 'Family/FamilyGraph',
  component: FamilyGraph,
  args: { data, meId: 'carol', height: 520 },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof FamilyGraph>;

export const BlendedFamily: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect((await canvas.findAllByText('Answered alike')).length).toBeGreaterThan(0);
    await expect(canvas.getByRole('combobox')).toBeInTheDocument();
  },
};

export const WithHouseholds: Story = {
  args: { initialOptions: { households: true, minAlike: 1 } },
};
