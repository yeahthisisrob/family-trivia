import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';

import RouletteGame from './RouletteGame';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof RouletteGame> = {
  title: 'Arcade/RouletteGame',
  component: RouletteGame,
  parameters: { layout: 'centered' },
  args: {
    userId: 'alice',
    onClose: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof RouletteGame>;

const casinoHandlers = [
  http.get(`${API}/casino/balance`, () =>
    HttpResponse.json({ balance: 50, floor: 35 }),
  ),
  http.post(`${API}/casino/balance`, () =>
    HttpResponse.json({ balance: 50, floor: 35 }),
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
          HttpResponse.json({ balance: 5, floor: 5 }),
        ),
        http.post(`${API}/casino/balance`, () =>
          HttpResponse.json({ balance: 5, floor: 5 }),
        ),
      ],
    },
  },
};
