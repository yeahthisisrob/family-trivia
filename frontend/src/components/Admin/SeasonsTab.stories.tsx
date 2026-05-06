import SeasonsTab from './SeasonsTab';
import { AdminStoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SeasonsTab> = {
  title: 'Admin/SeasonsTab',
  component: SeasonsTab,
  parameters: { layout: 'padded' },
  decorators: [(Story, ctx) => (
    <AdminStoryProviders admin={ctx.parameters.admin}>
      <Story />
    </AdminStoryProviders>
  )],
};
export default meta;
type Story = StoryObj<typeof SeasonsTab>;

export const Empty: Story = {
  parameters: { admin: { seasons: [] } },
};

export const WithSeasons: Story = {
  parameters: {
    admin: {
      seasons: [
        { seasonNumber: 2, name: 'Spring Season', status: 'active', startDate: '2026-03-01', endDate: '2026-05-31' },
        { seasonNumber: 1, name: 'Winter Season', status: 'ended', startDate: '2025-12-01', endDate: '2026-02-28' },
      ],
    },
  },
};
