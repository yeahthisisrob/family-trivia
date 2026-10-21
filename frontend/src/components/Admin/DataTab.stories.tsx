import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { peopleHandlers } from '../../features/admin-people/ui/peopleMocks';
import DataTab from './DataTab';

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
        ...peopleHandlers(),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof DataTab>;

export const Default: Story = {};
