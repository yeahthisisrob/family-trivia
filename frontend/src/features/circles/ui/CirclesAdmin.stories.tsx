import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CirclesAdmin, SamePersonDialog } from './CirclesAdmin';

const withJoined = http.get('*/admin/circles', () =>
  HttpResponse.json({
    ok: true,
    data: {
      owner: true,
      circles: [
        { id: 'home', name: 'The Smiths', kind: 'family', root: true },
        { id: 'crew', name: 'The Springfield Crew', kind: 'friends' },
        { id: 'everyone', name: 'Everyone', kind: 'mixed', sources: ['home', 'crew'] },
        {
          id: 'summer',
          name: 'Summer House',
          kind: 'mixed',
          sources: ['home', 'crew'],
          endedAt: '2026-09-01T00:00:00Z',
        },
      ],
    },
  }),
);

const grandmaJo = {
  a: { circleId: 'home', id: 'jo', name: 'Grandma Jo', circleName: 'The Smiths' },
  b: { circleId: 'crew', id: 'grandma', name: 'Grandma Jo', circleName: 'The Springfield Crew' },
};
const sameHandler = http.get('*/admin/circles/same', () =>
  HttpResponse.json({ ok: true, data: { suggestions: [grandmaJo] } }),
);

const all = (owner: boolean) =>
  http.get('*/admin/circles', () =>
    HttpResponse.json({
      ok: true,
      data: {
        owner,
        circles: owner
          ? [
              { id: 'home', name: 'The Smiths', kind: 'family', root: true },
              { id: 'crew', name: 'The Springfield Crew', kind: 'friends' },
            ]
          : [],
      },
    }),
  );

const meta: Meta<typeof CirclesAdmin> = {
  title: 'Features/Circles/CirclesAdmin',
  component: CirclesAdmin,
  args: { currentId: 'home', yourName: 'Alice' },
};
export default meta;
type Story = StoryObj<typeof CirclesAdmin>;

/** The owner sees every circle and starts new ones: who's in it, and how it looks. */
export const Owner: Story = {
  parameters: { msw: { handlers: [all(true)] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(await c.findByText('The Springfield Crew')).toBeInTheDocument();
    await userEvent.click(c.getByRole('button', { name: /Start a circle/ }));
    const d = within(document.body);
    await expect(await d.findByText('Family and friends')).toBeInTheDocument();
    await expect(d.getByRole('button', { name: /Sunset/, pressed: true })).toBeInTheDocument();
    await expect(d.getByRole('button', { name: 'Start and open it' })).toBeDisabled();
    await userEvent.type(d.getByLabelText('Name'), 'The Crew');
    await expect(d.getByRole('button', { name: 'Start and open it' })).toBeEnabled();
  },
};

/** Anyone else sees nothing here. */
export const NotTheOwner: Story = {
  parameters: { msw: { handlers: [all(false)] } },
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 300));
    await expect(within(canvasElement).queryByText('Your circles')).not.toBeInTheDocument();
  },
};

/** Joined circles say what they join; one can be split, a split one joined again. */
export const JoinedAndSplit: Story = {
  parameters: { msw: { handlers: [withJoined, sameHandler] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(await c.findAllByText('Joins The Smiths and The Springfield Crew')).toHaveLength(
      2,
    );
    await expect(c.getByRole('button', { name: 'Join again' })).toBeInTheDocument();
    await userEvent.click(c.getByRole('button', { name: 'Split' }));
    const d = within(document.body);
    await expect(await d.findByText('Split Everyone?')).toBeInTheDocument();
    await expect(d.getByText(/nothing is deleted/)).toBeInTheDocument();
  },
};

/** Joining: pick two or more circles; the name starts from theirs. */
export const JoinCircles: Story = {
  parameters: { msw: { handlers: [all(true)] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: /Join circles/ }));
    const d = within(document.body);
    const go = await d.findByRole('button', { name: 'Join them' });
    await expect(go).toBeDisabled();
    await userEvent.click(d.getByLabelText('The Smiths'));
    await userEvent.click(d.getByLabelText('The Springfield Crew'));
    await expect(go).toBeEnabled();
    await expect(d.getByPlaceholderText('The Smiths + The Springfield Crew')).toBeInTheDocument();
  },
};

/** The same name in two joined circles, nobody signed in as her: one tap says if she's one person. */
export const SamePerson: StoryObj<typeof SamePersonDialog> = {
  render: () => (
    <SamePersonDialog suggestions={[grandmaJo]} onAnswer={fn(async () => {})} onClose={fn()} />
  ),
  play: async () => {
    const d = within(document.body);
    await expect(await d.findByText('The same person?')).toBeInTheDocument();
    await expect(d.getByText('in The Smiths and in The Springfield Crew')).toBeInTheDocument();
    await expect(d.getByRole('button', { name: 'Same person' })).toBeEnabled();
  },
};

/** A joined circle with someone to answer about shows how many. */
export const SameToAnswer: Story = {
  parameters: { msw: { handlers: [withJoined, sameHandler] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByText('1 might be the same person'));
    await expect(await within(document.body).findByText('The same person?')).toBeInTheDocument();
  },
};
