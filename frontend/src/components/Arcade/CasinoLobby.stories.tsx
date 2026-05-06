import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';

import CasinoLobby from './CasinoLobby';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof CasinoLobby> = {
  title: 'Arcade/CasinoLobby',
  component: CasinoLobby,
  parameters: { layout: 'centered' },
  args: { userId: 'alice', onClose: fn() },
  decorators: [(Story) => (
    <StoryProviders>
      <NotificationProvider userId="alice">
        <Story />
      </NotificationProvider>
    </StoryProviders>
  )],
};
export default meta;
type Story = StoryObj<typeof CasinoLobby>;

const casinoHandlers = [
  http.get(`${API}/casino/balance`, () =>
    HttpResponse.json({ balance: 42, floor: 35 }),
  ),
  http.post(`${API}/casino/balance`, () =>
    HttpResponse.json({ balance: 42, floor: 35 }),
  ),
  http.get(`${API}/arcade/leaderboard`, () =>
    HttpResponse.json({
      scores: [
        { userId: 'alice', score: 42, date: '2026-04-10T10:00:00Z', mode: 'arcade' },
        { userId: 'bob', score: 38, date: '2026-04-09T15:30:00Z', mode: 'arcade' },
        { userId: 'carol', score: 35, date: '2026-04-08T09:00:00Z', mode: 'arcade' },
      ],
    }),
  ),
  http.get(`${API}/notifications`, () =>
    HttpResponse.json({ unreadCount: 0, items: [] }),
  ),
];

export const Default: Story = {
  parameters: { msw: { handlers: casinoHandlers } },
};

export const HighBalance: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/casino/balance`, () =>
          HttpResponse.json({ balance: 128, floor: 35 }),
        ),
        ...casinoHandlers.slice(1),
      ],
    },
  },
};
