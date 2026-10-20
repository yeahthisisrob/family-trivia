import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, within } from 'storybook/test';
import { peopleHandlers } from '../../../features/admin-people/ui/peopleMocks';
import { AdminPage } from './AdminPage';

const seasons = http.get('*/admin/seasons', () =>
  HttpResponse.json({
    ok: true,
    data: {
      currentSeasonNumber: 2,
      seasons: [
        {
          seasonNumber: 2,
          name: 'Spring Season',
          status: 'active',
          startDate: '2026-03-01',
          endDate: null,
          message: null,
        },
      ],
      success: true,
    },
  }),
);

const meta: Meta<typeof AdminPage> = {
  title: 'Admin/AdminPage',
  component: AdminPage,
  args: { userId: 'alice' },
  parameters: {
    layout: 'padded',
    msw: { handlers: [seasons, ...peopleHandlers()] },
    docs: {
      description: {
        component:
          'Admin: one tab per part of the circle, named in the URL. Each tab reads its own ' +
          'server data and shows its own loading and errors.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AdminPage>;

/** Opened on a tab from its link: the tab is picked and only its data is asked for. */
export const OnSeasons: Story = {
  parameters: { route: '/admin/seasons' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Spring Season')).toBeInTheDocument();
    await expect(canvas.getByRole('tab', { name: 'Seasons', selected: true })).toBeVisible();
  },
};

export const OnPlayers: Story = {
  parameters: { route: '/admin/players' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('alice')).toBeInTheDocument();
  },
};
