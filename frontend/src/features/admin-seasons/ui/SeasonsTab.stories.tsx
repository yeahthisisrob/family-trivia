import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { SeasonsTab } from './SeasonsTab';

const SPRING = {
  seasonNumber: 2,
  name: 'Spring Season',
  status: 'active',
  startDate: '2026-03-01',
  endDate: '2026-05-31',
  message: null,
};
const WINTER = {
  seasonNumber: 1,
  name: 'Winter Season',
  status: 'concluded',
  startDate: '2025-12-01',
  endDate: '2026-02-28',
  message: 'Thanks for a cozy winter, everyone.',
};

const seasons = (list: unknown[], currentSeasonNumber: number | null) =>
  http.get('*/admin/seasons', () =>
    HttpResponse.json({ ok: true, data: { currentSeasonNumber, seasons: list, success: true } }),
  );

const meta: Meta<typeof SeasonsTab> = {
  title: 'Admin/SeasonsTab',
  component: SeasonsTab,
  parameters: {
    layout: 'padded',
    msw: { handlers: [seasons([SPRING, WINTER], 2)] },
    docs: {
      description: {
        component:
          'Admin › Seasons: the active season first, then the others. A save asks again for ' +
          'everything that shows a season; deleting one asks first.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof SeasonsTab>;

export const Empty: Story = {
  parameters: { msw: { handlers: [seasons([], null)] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No seasons configured yet')).toBeInTheDocument();
    await expect(canvas.getByText('No Active Season')).toBeInTheDocument();
  },
};

export const WithSeasons: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Spring Season')).toBeInTheDocument();
    await expect(canvas.getByText('Active')).toBeInTheDocument();
    await expect(canvas.getByText('Winter Season')).toBeInTheDocument();
  },
};

/** The server turns a save down: the dialog stays open and says why. */
export const SaveTurnedDown: Story = {
  parameters: {
    msw: {
      handlers: [
        seasons([SPRING, WINTER], 2),
        http.post('*/admin/seasons', () =>
          HttpResponse.json({ ok: false, error: 'Season 3 already exists' }, { status: 409 }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole('button', { name: 'Add Season' }));
    await userEvent.type(body.getByLabelText('Name'), 'Summer');
    await userEvent.click(body.getByRole('button', { name: 'Add' }));
    await expect(await body.findByText('Season 3 already exists')).toBeInTheDocument();
    await expect(body.getByRole('dialog')).toBeInTheDocument();
  },
};
