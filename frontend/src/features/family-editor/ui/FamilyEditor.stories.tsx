import type { Family } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { FamilyEditor } from './FamilyEditor';

// A made-up blended family (never a real one: docs/decisions/0006).
const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    grace: {
      id: 'grace',
      name: 'Grandma Grace',
      born: { date: '1940' },
      participation: 'not-playing',
      memorial: { died: '2024', dedication: 'Always in the garden.' },
    },
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    erin: { id: 'erin', name: 'Erin', participation: 'playing' },
    hal: { id: 'hal', name: 'Hal', participation: 'paused' },
    carol: { id: 'carol', name: 'Carol', participation: 'playing' },
    frank: { id: 'frank', name: 'Frank', participation: 'not-playing' },
  },
  ties: [
    {
      id: 't1',
      type: 'partner',
      a: 'alice',
      b: 'bob',
      kind: 'married',
      ended: { reason: 'divorced', date: '2022' },
    },
    { id: 't2', type: 'partner', a: 'bob', b: 'erin', kind: 'married' },
    { id: 't3', type: 'partner', a: 'alice', b: 'hal', kind: 'partnered' },
    { id: 't4', type: 'parent', parent: 'grace', child: 'bob', kind: 'birth' },
    { id: 't5', type: 'parent', parent: 'alice', child: 'carol', kind: 'birth' },
    { id: 't6', type: 'parent', parent: 'bob', child: 'carol', kind: 'birth' },
    { id: 't7', type: 'parent', parent: 'erin', child: 'frank', kind: 'birth' },
  ],
  households: {
    mom: { id: 'mom', name: "Mom's house", members: ['alice', 'hal', 'carol'] },
    dad: { id: 'dad', name: "Dad's house", members: ['bob', 'erin', 'frank', 'carol'] },
  },
};

const meta: Meta<typeof FamilyEditor> = {
  title: 'Admin/FamilyEditor',
  component: FamilyEditor,
  args: { adminUserId: 'alice' },
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get('*/family', () =>
          HttpResponse.json({ ok: true, data: { family, photoUrls: {} } }),
        ),
        http.get('*/admin/archive/permissions', () =>
          HttpResponse.json({ ok: true, data: { everyone: true, users: { frank: false } } }),
        ),
        http.put('*/admin/archive/permissions', async ({ request }) =>
          HttpResponse.json({ ok: true, data: await request.json() }),
        ),
        http.put('*/admin/family', async ({ request }) => {
          const body = (await request.json()) as { family: Family };
          return HttpResponse.json({ ok: true, data: { family: body.family, photoUrls: {} } });
        }),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof FamilyEditor>;

export const BlendedFamily: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Grandma Grace')).toBeInTheDocument();
    await expect(canvas.getByText('In memory')).toBeInTheDocument();
    await expect(canvas.getByText('Paused')).toBeInTheDocument();
  },
};

/** Open Carol: her stepparents and stepsibling are worked out from the ties. */
export const DerivedConnections: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Carol'));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Erin: stepparent')).toBeInTheDocument();
    await expect(body.getByText('Frank: stepsibling')).toBeInTheDocument();
    await expect(body.getByText('Grandma Grace: grandparent')).toBeInTheDocument();
  },
};

// A made-up circle of friends on the same model: friendships, a couple, crews.
const crew: Family = {
  version: 2,
  name: 'The Crew',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    carol: { id: 'carol', name: 'Carol', participation: 'playing' },
    dave: { id: 'dave', name: 'Dave', participation: 'playing' },
  },
  ties: [
    {
      id: 'f1',
      type: 'friend',
      a: 'alice',
      b: 'bob',
      met: { how: 'college', when: '2004', where: 'Springfield' },
    },
    { id: 'f2', type: 'friend', a: 'alice', b: 'carol', met: { how: 'work' } },
    { id: 'p1', type: 'partner', a: 'carol', b: 'dave', kind: 'married' },
  ],
  households: {
    college: { id: 'college', name: 'The college crew', members: ['alice', 'bob'] },
  },
};

/** The same editor in a friends circle: crews, friendships and how they met. */
export const FriendsCircle: Story = {
  beforeEach: () => {
    localStorage.setItem(
      'familyTriviaCircles',
      JSON.stringify({
        current: 'crew',
        circles: [{ id: 'crew', name: 'The Crew', kind: 'friends', userId: 'alice' }],
      }),
    );
    return () => localStorage.removeItem('familyTriviaCircles');
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/family', () =>
          HttpResponse.json({ ok: true, data: { family: crew, photoUrls: {} } }),
        ),
        http.get('*/admin/archive/permissions', () =>
          HttpResponse.json({ ok: true, data: { everyone: true, users: {} } }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Crews')).toBeInTheDocument();
    await expect(canvas.getByText('Add a crew')).toBeInTheDocument();
    await userEvent.click(canvas.getByText('Alice'));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByDisplayValue('Springfield')).toBeInTheDocument();
    // A friends circle offers "A friend" first when adding a connection.
    await expect(body.getByText('A friend')).toBeInTheDocument();
  },
};
