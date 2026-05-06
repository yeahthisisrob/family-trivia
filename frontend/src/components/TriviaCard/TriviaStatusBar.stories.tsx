import { http, HttpResponse } from 'msw';

import TriviaStatusBar from './TriviaStatusBar';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof TriviaStatusBar> = {
  title: 'TriviaCard/TriviaStatusBar',
  component: TriviaStatusBar,
  parameters: { layout: 'padded' },
  args: { userId: 'alice' },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof TriviaStatusBar>;

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/answer-grid`, () => HttpResponse.json({
          maxSlots: 5,
          users: [
            { userId: 'alice', slots: [
              { correct: true, isCatchingUp: false, isGameMode: false },
              { correct: true, isCatchingUp: false, isGameMode: false },
              { correct: false, isCatchingUp: false, isGameMode: false },
              { correct: true, isCatchingUp: true, isGameMode: false },
              { correct: true, isCatchingUp: false, isGameMode: true },
            ] },
            { userId: 'bob', slots: [
              { correct: true, isCatchingUp: false, isGameMode: false },
              { correct: false, isCatchingUp: false, isGameMode: false },
            ] },
          ],
        })),
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/answer-grid`, () => HttpResponse.json({ maxSlots: 0, users: [] })),
      ],
    },
  },
};
