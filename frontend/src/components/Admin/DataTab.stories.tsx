import { http, HttpResponse } from 'msw';

import DataTab from './DataTab';
import { AdminStoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof DataTab> = {
  title: 'Admin/DataTab',
  component: DataTab,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get(`${API}/admin/user-facts`, () => HttpResponse.json({ history: [] })),
        http.get(`${API}/admin/user-trivia`, () => HttpResponse.json({ history: [] })),
        http.get(`${API}/admin/game-sessions`, () => HttpResponse.json({ sessions: [] })),
      ],
    },
  },
  decorators: [(Story, ctx) => (
    <AdminStoryProviders admin={ctx.parameters.admin}>
      <Story />
    </AdminStoryProviders>
  )],
};
export default meta;
type Story = StoryObj<typeof DataTab>;

export const Default: Story = {
  parameters: {
    admin: {
      players: [
        { userId: 'alice', name: 'Alice', groupId: 'parents', isAdmin: false },
      ],
    },
  },
};
