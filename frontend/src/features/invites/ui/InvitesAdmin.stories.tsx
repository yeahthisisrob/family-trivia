import type { Invite, PendingJoin } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { InvitesAdmin } from './InvitesAdmin';

const day = 24 * 60 * 60 * 1000;
const invite = (over: Partial<Invite>): Invite => ({
  token: 'AbCdEfGhIjKlMnOpQrStUv',
  circleIds: ['crew'],
  for: { kind: 'anyone' },
  createdBy: 'alice',
  createdAt: new Date(Date.now() - day).toISOString(),
  expiresAt: new Date(Date.now() + 6 * day).toISOString(),
  maxUses: null,
  uses: 3,
  approval: false,
  ...over,
});

const joins: PendingJoin[] = [
  {
    id: 'j1',
    token: 'x',
    email: 'dee@example.com',
    details: { name: 'Dee', howWeMet: 'college roommates' },
    requestedAt: new Date().toISOString(),
  },
];

const list = (invites: Invite[], waiting: PendingJoin[]) => [
  http.get('*/admin/invites', () =>
    HttpResponse.json({ ok: true, data: { invites, joins: waiting } }),
  ),
  http.post('*/admin/invites', () =>
    HttpResponse.json({
      ok: true,
      data: { invite: invite({ token: 'NewLinkTokenNewLinkTok', uses: 0 }) },
    }),
  ),
];

const meta: Meta<typeof InvitesAdmin> = {
  title: 'Features/Invites/InvitesAdmin',
  component: InvitesAdmin,
  args: {
    circleName: 'The Springfield Crew',
    people: [
      { id: 'alice', name: 'Alice', joined: true },
      { id: 'sam', name: 'Uncle Sam', joined: false },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof InvitesAdmin>;

/** Someone waiting for a yes comes first; links show their uses and how long they last. */
export const WithSomeoneWaiting: Story = {
  parameters: {
    msw: {
      handlers: list(
        [
          invite({}),
          invite({
            token: 'OldTokenOldTokenOldTok',
            for: { kind: 'person', userId: 'sam' },
            uses: 1,
            maxUses: 1,
          }),
        ],
        joins,
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(await c.findByText('Someone is waiting to join')).toBeInTheDocument();
    await expect(c.getByText(/college roommates/)).toBeInTheDocument();
    await expect(await c.findByText('For Uncle Sam')).toBeInTheDocument();
    await expect(c.getByText('Used')).toBeInTheDocument();
  },
};

/** Making a link shows it, ready to share. */
export const MakeALink: Story = {
  parameters: { msw: { handlers: list([], []) } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: /Make link/ }));
    await expect(await c.findByText(/join\?t=NewLinkTokenNewLinkTok/)).toBeInTheDocument();
  },
};
