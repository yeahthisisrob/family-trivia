import GroupsTab from './GroupsTab';
import { AdminStoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof GroupsTab> = {
  title: 'Admin/GroupsTab',
  component: GroupsTab,
  parameters: { layout: 'padded' },
  decorators: [(Story, ctx) => (
    <AdminStoryProviders admin={ctx.parameters.admin}>
      <Story />
    </AdminStoryProviders>
  )],
};
export default meta;
type Story = StoryObj<typeof GroupsTab>;

export const Empty: Story = {
  parameters: { admin: { groups: [] } },
};

export const WithGroups: Story = {
  parameters: {
    admin: {
      groups: [
        { groupId: 'parents', name: 'Parents', description: 'The grown-ups', side: 'side1' },
        { groupId: 'kids', name: 'Kids', description: 'The young crew', side: 'side1' },
      ],
      sides: {
        side1: { name: 'Side 1', color: '#2196F3' },
        side2: { name: 'Side 2', color: '#FF9800' },
      },
    },
  },
};
