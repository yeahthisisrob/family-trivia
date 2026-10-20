import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, within } from 'storybook/test';
import { SystemInfoTab } from './SystemInfoTab';

const info = (healthy: boolean) => ({
  deployment: {
    region: 'us-east-1',
    bucket: 'family-trivia-bucket',
    bedrockModel: 'claude-sonnet-4',
    nodeEnv: 'production',
  },
  health: {
    usersConfig: true,
    familyHierarchy: healthy,
    seasonsConfig: true,
    categories: healthy,
    allHealthy: healthy,
  },
  stats: {
    userCount: 8,
    activeSeason: healthy ? { name: 'Spring Season', startDate: '2026-03-01' } : null,
    totalSeasons: 2,
    triviaQuestionCount: 512,
  },
});

const answers = (healthy: boolean) => [
  http.get('*/admin/system-info', () => HttpResponse.json({ ok: true, data: info(healthy) })),
];

const meta: Meta<typeof SystemInfoTab> = {
  title: 'Admin/SystemInfoTab',
  component: SystemInfoTab,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof SystemInfoTab>;

export const Healthy: Story = {
  parameters: { msw: { handlers: answers(true) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('All Good')).toBeInTheDocument();
    await expect(canvas.getByText('Spring Season')).toBeInTheDocument();
  },
};

export const Unhealthy: Story = {
  parameters: { msw: { handlers: answers(false) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Issues Found')).toBeInTheDocument();
  },
};
