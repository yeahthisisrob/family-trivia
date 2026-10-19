import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { JoinScreen } from './JoinScreen';

const preview = (data: unknown, status = 200) =>
  http.get('*/invite', () =>
    HttpResponse.json(
      status === 200 ? { ok: true, data } : { ok: false, error: 'Invite not found' },
      {
        status,
      },
    ),
  );

const meta: Meta<typeof JoinScreen> = {
  title: 'Features/Invites/JoinScreen',
  component: JoinScreen,
  parameters: { layout: 'fullscreen' },
  args: { token: 'AbCdEfGhIjKlMnOpQrStUv', googleClientId: 'storybook.apps.googleusercontent.com' },
};
export default meta;
type Story = StoryObj<typeof JoinScreen>;

/** A link for anyone, to a circle of friends: a name, how you know everyone, then Google. */
export const FriendsInvite: Story = {
  parameters: {
    msw: {
      handlers: [
        preview({
          state: 'open',
          circle: { name: 'The Springfield Crew', kind: 'friends' },
          approval: false,
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(await c.findByText('The Springfield Crew')).toBeInTheDocument();
    await expect(c.getByText('Add your name to continue')).toBeInTheDocument();
    await userEvent.type(c.getByLabelText('What should everyone call you?'), 'Dee');
    await expect(c.queryByText('Add your name to continue')).not.toBeInTheDocument();
    await expect(c.getByLabelText('How do you know everyone?')).toBeInTheDocument();
  },
};

/** A link for one person the admin already added: just sign in. */
export const ForSomeone: Story = {
  parameters: {
    msw: {
      handlers: [
        preview({
          state: 'open',
          circle: { name: 'The Smiths', kind: 'family' },
          forName: 'Uncle Sam',
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(await c.findByText('Uncle Sam')).toBeInTheDocument();
    await expect(c.queryByLabelText('What should everyone call you?')).not.toBeInTheDocument();
  },
};

/** A link that has run out says so, and nothing else. */
export const Expired: Story = {
  parameters: { msw: { handlers: [preview({ state: 'expired' })] } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('This invite has expired.'),
    ).toBeInTheDocument();
  },
};

export const BrokenLink: Story = {
  parameters: { msw: { handlers: [preview(null, 404)] } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("This invite link doesn't work."),
    ).toBeInTheDocument();
  },
};
