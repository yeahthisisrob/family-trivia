import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';

import AllCelebrationsDialog from './AllCelebrationsDialog';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof AllCelebrationsDialog> = {
  title: 'UpcomingDates/AllCelebrationsDialog',
  component: AllCelebrationsDialog,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [
        http.get(`${API}/celebrations`, () => HttpResponse.json({
          celebrations: [
            { id: '1', name: "Alice's Birthday", date: '2026-05-15', type: 'birthday', userId: 'alice', createdBy: 'bob' },
            { id: '2', name: 'Anniversary', date: '2026-06-20', type: 'anniversary', userId: 'parents', createdBy: 'alice' },
          ],
        })),
      ],
    },
  },
  args: {
    open: true,
    onClose: fn(),
    currentUserId: 'alice',
    onDeleted: fn(),
    refreshTrigger: 0,
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof AllCelebrationsDialog>;

export const WithCelebrations: Story = {};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/celebrations`, () => HttpResponse.json({ celebrations: [] })),
      ],
    },
  },
};
