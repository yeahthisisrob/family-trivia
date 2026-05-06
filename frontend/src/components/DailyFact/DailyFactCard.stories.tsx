import { http, HttpResponse, delay } from 'msw';

import DailyFactCard from './DailyFactCard';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof DailyFactCard> = {
  title: 'Home/DailyFactCard',
  component: DailyFactCard,
  parameters: { layout: 'padded' },
  args: { userId: 'alice' },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof DailyFactCard>;

// ── MSW handlers ─────────────────────────────────────────────────

const todayQuestion = {
  question: "What's a family tradition you'd love to bring back?",
  answered: false,
  questionType: 'shared',
};

const answeredToday = {
  question: "What's a family tradition you'd love to bring back?",
  answered: true,
  questionType: 'shared',
};

const firstPersonQuestion = {
  question: '',
  answered: false,
  isFirstPerson: true,
};

const emptyHistory = {
  history: [],
  basicQuestions: [],
  allSharedQuestions: [],
};

const historyWithMissed = {
  history: [
    { date: '2026-04-09', questionType: 'shared', answered: true, skipped: false, question: "What's your favorite meal?", answer: 'Pizza' },
  ],
  basicQuestions: [],
  allSharedQuestions: [
    { date: '2026-04-07', question: "What's your earliest childhood memory?", skipped: false },
    { date: '2026-04-08', question: 'What song always makes you smile?', skipped: false },
    { date: '2026-04-09', question: "What's your favorite meal?", skipped: false },
  ],
};

const factResponse = {
  success: true,
  fact: "That's wonderful! Family traditions create lasting bonds. Studies show that shared rituals strengthen family identity across generations.",
};

const questionOptions = {
  options: [
    { question: 'What hobby would you pick up if time and money were no issue?', theme: 'Dreams' },
    { question: "What's the most adventurous thing you've ever done?", theme: 'Adventure' },
    { question: 'If you could have dinner with anyone, who would it be?', theme: 'Fun' },
  ],
};

// ── Stories ───────────────────────────────────────────────────────

export const TodaysQuestion: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, () => HttpResponse.json(todayQuestion)),
        http.get(`${API}/user-fact-history`, () => HttpResponse.json(emptyHistory)),
        http.post(`${API}/submit-daily-fact`, async () => {
          await delay(800);
          return HttpResponse.json(factResponse);
        }),
      ],
    },
  },
};

export const TodaysQuestionModal: Story = {
  args: { mode: 'modal' },
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, () => HttpResponse.json(todayQuestion)),
        http.get(`${API}/user-fact-history`, () => HttpResponse.json(emptyHistory)),
        http.post(`${API}/submit-daily-fact`, async () => {
          await delay(800);
          return HttpResponse.json(factResponse);
        }),
      ],
    },
  },
};

export const CatchUpMode: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, () => HttpResponse.json(answeredToday)),
        http.get(`${API}/user-fact-history`, () => HttpResponse.json(historyWithMissed)),
        http.post(`${API}/submit-daily-fact`, async () => {
          await delay(800);
          return HttpResponse.json(factResponse);
        }),
      ],
    },
  },
};

export const CatchUpModeModal: Story = {
  args: { mode: 'modal' },
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, () => HttpResponse.json(answeredToday)),
        http.get(`${API}/user-fact-history`, () => HttpResponse.json(historyWithMissed)),
        http.post(`${API}/submit-daily-fact`, async () => {
          await delay(800);
          return HttpResponse.json(factResponse);
        }),
      ],
    },
  },
};

export const FirstPerson: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, () => HttpResponse.json(firstPersonQuestion)),
        http.post(`${API}/generate-question-options`, async () => {
          await delay(1200);
          return HttpResponse.json(questionOptions);
        }),
        http.post(`${API}/daily-fact`, () => HttpResponse.json({ question: questionOptions.options[0].question, answered: false })),
        http.post(`${API}/submit-daily-fact`, async () => {
          await delay(800);
          return HttpResponse.json(factResponse);
        }),
      ],
    },
  },
};

export const AllDone: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, () => HttpResponse.json(answeredToday)),
        http.get(`${API}/user-fact-history`, () => HttpResponse.json(emptyHistory)),
      ],
    },
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, async () => {
          await delay(999999); // Never resolves
          return HttpResponse.json(todayQuestion);
        }),
      ],
    },
  },
};
