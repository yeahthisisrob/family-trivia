import FamilyTreeTab from './FamilyTreeTab';
import { AdminStoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FamilyTreeTab> = {
  title: 'Admin/FamilyTreeTab',
  component: FamilyTreeTab,
  parameters: { layout: 'padded' },
  decorators: [(Story, ctx) => (
    <AdminStoryProviders admin={ctx.parameters.admin}>
      <Story />
    </AdminStoryProviders>
  )],
};
export default meta;
type Story = StoryObj<typeof FamilyTreeTab>;

export const Empty: Story = {
  parameters: { admin: {} },
};

export const Loading: Story = {
  parameters: { admin: { loading: true } },
};
