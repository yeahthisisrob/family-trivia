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
