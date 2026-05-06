import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';

import BlackjackGame from './BlackjackGame';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof BlackjackGame> = {
  title: 'Arcade/BlackjackGame',
  component: BlackjackGame,
  parameters: { layout: 'centered' },
  args: {
    userId: 'alice',
    onClose: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof BlackjackGame>;

const casinoHandlers = [
  http.get(`${API}/casino/balance`, () =>
    HttpResponse.json({ balance: 42, floor: 35 }),
  ),
  http.post(`${API}/casino/balance`, () =>
    HttpResponse.json({ balance: 42, floor: 35 }),
  ),
];

export const Default: Story = {
  parameters: { msw: { handlers: casinoHandlers } },
};

export const LowBalance: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/casino/balance`, () =>
          HttpResponse.json({ balance: 3, floor: 3 }),
        ),
        http.post(`${API}/casino/balance`, () =>
          HttpResponse.json({ balance: 3, floor: 3 }),
        ),
      ],
    },
  },
};
