import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';

import DailyFactModal from './DailyFactModal';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof DailyFactModal> = {
  title: 'DailyFact/DailyFactModal',
  component: DailyFactModal,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get(`${API}/daily-fact`, () => HttpResponse.json({
          question: "What's a family tradition you'd love to bring back?",
          answered: false,
          questionType: 'shared',
        })),
        http.get(`${API}/user-fact-history`, () => HttpResponse.json({
          history: [],
          basicQuestions: [],
          allSharedQuestions: [],
        })),
      ],
    },
  },
  args: {
    userId: 'alice',
    onFactSubmitted: fn(),
    onDismissed: fn(),
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof DailyFactModal>;

export const Default: Story = {};
