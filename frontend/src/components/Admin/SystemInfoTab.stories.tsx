import { http, HttpResponse } from 'msw';

import SystemInfoTab from './SystemInfoTab';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof SystemInfoTab> = {
  title: 'Admin/SystemInfoTab',
  component: SystemInfoTab,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof SystemInfoTab>;

export const Healthy: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/admin/system-info`, () => HttpResponse.json({
          deployment: {
            region: 'us-east-1',
            bucket: 'family-trivia-bucket',
            bedrockModel: 'claude-sonnet-4',
            nodeEnv: 'production',
          },
          health: {
            usersConfig: true,
            familyHierarchy: true,
            seasonsConfig: true,
            categories: true,
            allHealthy: true,
          },
          stats: {
            totalPlayers: 8,
            totalFacts: 240,
            totalTriviaAnswers: 512,
          },
        })),
      ],
    },
  },
};

export const Unhealthy: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/admin/system-info`, () => HttpResponse.json({
          deployment: {
            region: 'us-east-1',
            bucket: 'family-trivia-bucket',
            bedrockModel: 'claude-sonnet-4',
            nodeEnv: 'production',
          },
          health: {
            usersConfig: true,
            familyHierarchy: false,
            seasonsConfig: true,
            categories: false,
            allHealthy: false,
          },
          stats: { totalPlayers: 8, totalFacts: 240, totalTriviaAnswers: 512 },
        })),
      ],
    },
  },
};
