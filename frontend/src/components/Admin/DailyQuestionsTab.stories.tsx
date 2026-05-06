import { http, HttpResponse } from 'msw';

import DailyQuestionsTab from './DailyQuestionsTab';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof DailyQuestionsTab> = {
  title: 'Admin/DailyQuestionsTab',
  component: DailyQuestionsTab,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get(`${API}/admin/daily-questions`, () => HttpResponse.json({
          questions: [
            { date: '2026-04-10', question: "What's your favorite memory from this week?", createdBy: 'alice' },
            { date: '2026-04-09', question: 'If you could travel anywhere tomorrow, where would you go?', createdBy: 'bob' },
          ],
        })),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof DailyQuestionsTab>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/admin/daily-questions`, () => HttpResponse.json({ questions: [] })),
      ],
    },
  },
};
