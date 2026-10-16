import { AI_TASKS, MODEL_CATALOG, SETTINGS } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { SettingsPage } from './SettingsPage';

const sonnet = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const haiku = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

const admin = {
  settings: SETTINGS.map((s) => ({
    ...s,
    value:
      s.key === 'features.photos' ? false : s.key === 'ai.model.spotlight' ? sonnet : s.default,
    source: s.key === 'features.photos' || s.key === 'ai.model.spotlight' ? 'stored' : 'default',
  })),
  models: MODEL_CATALOG.map((m) => ({
    ...m,
    availability: m.id.includes('4-5')
      ? { ok: true }
      : { ok: false, reason: 'Not enabled for this AWS account (Bedrock console › Model access)' },
  })),
  availabilityCheckedAt: '2026-10-16T12:00:00Z',
  tasks: AI_TASKS.map((t) => ({ ...t, model: t.role === 'fast' ? haiku : sonnet })),
  defaults: { writer: sonnet, fast: haiku },
  players: 14,
  usage: {
    thisMonth: {
      trivia: { [sonnet]: { calls: 120, input: 300000, output: 60000 } },
      roast: { [haiku]: { calls: 9, input: 54000, output: 6300 } },
    },
    lastMonth: {},
  },
};

const meta: Meta<typeof SettingsPage> = {
  title: 'Admin/SettingsPage',
  component: SettingsPage,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get('*/admin/settings', () => HttpResponse.json({ ok: true, data: admin })),
        http.put('*/admin/settings', () => HttpResponse.json({ ok: true, data: admin })),
        http.get('*/admin/archive/permissions', () =>
          HttpResponse.json({ ok: true, data: { everyone: true, users: {} } }),
        ),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof SettingsPage>;

export const Features: Story = {
  parameters: { route: '/admin/settings?section=features' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Photo albums')).toBeInTheDocument();
    await userEvent.click(canvas.getAllByRole('switch')[0] as HTMLElement);
    await expect(await canvas.findByText('1 unsaved change')).toBeInTheDocument();
  },
};

export const AiAndCost: Story = {
  parameters: { route: '/admin/settings?section=ai' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('This month so far')).toBeInTheDocument();
    await expect(canvas.getByText('Spotlights')).toBeInTheDocument();
  },
};
