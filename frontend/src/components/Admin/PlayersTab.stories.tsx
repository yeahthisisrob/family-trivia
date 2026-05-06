import PlayersTab from './PlayersTab';
import { AdminStoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof PlayersTab> = {
  title: 'Admin/PlayersTab',
  component: PlayersTab,
  parameters: { layout: 'padded' },
  decorators: [(Story, ctx) => (
    <AdminStoryProviders admin={ctx.parameters.admin}>
      <Story />
    </AdminStoryProviders>
  )],
};
export default meta;
type Story = StoryObj<typeof PlayersTab>;

export const Empty: Story = {
  parameters: { admin: { players: [] } },
};

export const WithPlayers: Story = {
  parameters: {
    admin: {
      players: [
        { userId: 'alice', name: 'Alice', groupId: 'parents', isAdmin: false },
        { userId: 'bob', name: 'Bob', groupId: 'parents', isAdmin: true },
        { userId: 'charlie', name: 'Charlie', groupId: 'kids', isAdmin: false },
      ],
      groups: [
        { groupId: 'parents', name: 'Parents', description: '' },
        { groupId: 'kids', name: 'Kids', description: '' },
      ],
    },
  },
};

export const Loading: Story = {
  parameters: { admin: { loading: true } },
};
