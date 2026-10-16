import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { ReactionBar } from './ReactionBar';

const names: Record<string, string> = { bob: 'Bob', erin: 'Erin', dave: 'Dave' };

const handlers = (byId: Record<string, unknown>) => [
  http.get('*/reactions', ({ request }) => {
    const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',');
    return HttpResponse.json({
      ok: true,
      data: {
        reactions: Object.fromEntries(ids.map((id) => [id, byId[id] ?? { by: [], mine: null }])),
      },
    });
  }),
  http.put('*/reactions', async ({ request }) => {
    const body = (await request.json()) as { contentId: string; reaction: string | null };
    return HttpResponse.json({
      ok: true,
      data: {
        contentId: body.contentId,
        summary: {
          by: body.reaction ? [{ userId: 'carol', reaction: body.reaction }] : [],
          mine: body.reaction,
        },
      },
    });
  }),
];

const meta: Meta<typeof ReactionBar> = {
  title: 'Reactions/ReactionBar',
  component: ReactionBar,
  args: { contentType: 'fact', me: 'carol', nameOf: (id) => names[id] ?? id },
  parameters: {
    msw: {
      handlers: handlers({
        bob_1: {
          by: [
            { userId: 'bob', reaction: 'laugh' },
            { userId: 'erin', reaction: 'laugh' },
            { userId: 'dave', reaction: 'love' },
          ],
          mine: null,
        },
      }),
    },
  },
};
export default meta;
type Story = StoryObj<typeof ReactionBar>;

export const WithReactions: Story = {
  args: { contentId: 'bob_1' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Ha, 2' })).toBeInTheDocument();
  },
};

export const FirstToReact: Story = {
  args: { contentId: 'bob_2' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'React' }));
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Hug' }));
    await expect(await canvas.findByRole('button', { name: 'Hug, 1' })).toBeInTheDocument();
  },
};
