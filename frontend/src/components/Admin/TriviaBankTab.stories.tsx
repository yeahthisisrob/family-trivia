import { http, HttpResponse } from 'msw';

import TriviaBankTab from './TriviaBankTab';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof TriviaBankTab> = {
  title: 'Admin/TriviaBankTab',
  component: TriviaBankTab,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get(`${API}/admin/trivia-bank/stats`, () => HttpResponse.json({
          totalQuestions: 1250,
          categories: [
            { category: 'History & Politics', count: 250, difficulties: { easy: 80, normal: 120, hard: 50 } },
            { category: 'Science & Nature', count: 300, difficulties: { easy: 100, normal: 150, hard: 50 } },
          ],
          sources: [['opentdb', 900], ['custom', 350]],
          questionsAsked: 512,
        })),
        http.get(`${API}/admin/trivia-bank/browse`, () => HttpResponse.json({
          questions: [
            { question: 'Sample question?', choices: ['A', 'B', 'C', 'D'], answer: 'A', category: 'History & Politics', difficulty: 'normal', source: 'opentdb' },
          ],
          total: 1,
        })),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof TriviaBankTab>;

export const Default: Story = {};
