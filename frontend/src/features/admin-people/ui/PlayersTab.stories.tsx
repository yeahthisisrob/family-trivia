import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, HttpResponse, http } from 'msw';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PlayersTab } from './PlayersTab';
import { peopleHandlers } from './peopleMocks';

const meta: Meta<typeof PlayersTab> = {
  title: 'Admin/PlayersTab',
  component: PlayersTab,
  parameters: { layout: 'padded', msw: { handlers: peopleHandlers() } },
};
export default meta;
type Story = StoryObj<typeof PlayersTab>;

export const Empty: Story = {
  parameters: { msw: { handlers: peopleHandlers({ empty: true }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No players configured')).toBeInTheDocument();
  },
};

export const WithPlayers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('alice')).toBeInTheDocument();
    await expect(canvas.getByText('Admin')).toBeInTheDocument();
    // Group names come with the groups, a read of their own that may answer later.
    await waitFor(() => expect(canvas.getAllByText('Parents')).toHaveLength(2));
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/admin/players', async () => {
          await delay('infinite');
          return HttpResponse.json({});
        }),
        ...peopleHandlers(),
      ],
    },
  },
};

/** Deleting asks first; a refusal from the server shows above the list. */
export const DeleteTurnedDown: Story = {
  parameters: {
    msw: {
      handlers: [
        http.delete('*/admin/players', () =>
          HttpResponse.json({ ok: false, error: 'Player "bob" not found' }, { status: 404 }),
        ),
        ...peopleHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText('bob');
    const deletes = canvas.getAllByTestId('DeleteIcon');
    await userEvent.click(deletes[1] as HTMLElement);
    await expect(
      await body.findByText('Are you sure you want to delete "bob"?'),
    ).toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: 'Delete' }));
    await expect(await canvas.findByText('Player "bob" not found')).toBeInTheDocument();
  },
};
