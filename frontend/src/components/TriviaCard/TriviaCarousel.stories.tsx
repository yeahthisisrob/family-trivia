import React from 'react';
import { expect, within } from 'storybook/test';

import TriviaCarousel from './TriviaCarousel';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TriviaCarousel> = {
  title: 'Trivia/Flow/TriviaCarousel',
  component: TriviaCarousel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Swipeable card carousel: history cards (left) → active question (center) → "Come back tomorrow" preview (right when done). CSS scroll-snap, no library needed.',
      },
    },
  },
  args: {
    userId: 'alice',
    groupId: 'smiths',
  },
  argTypes: {
    onAnswerResult: { action: 'answerResult' },
    forceDisabled: { control: 'boolean' },
  },
  decorators: [
    (Story, context) => (
      <StoryProviders
        userStatus={context.parameters.userStatus}
        trivia={context.parameters.trivia}
      >
        <div style={{ maxWidth: 420, margin: '0 auto', overflow: 'hidden' }}>
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof TriviaCarousel>;

/** Active state — user can answer, category grid showing */
export const Active: Story = {
  parameters: {
    userStatus: { hasAnsweredToday: false, canAnswerQuestion: true },
  },
};

/** Done — shows "Come back tomorrow" preview card when swiping right */
export const DoneWithPreview: Story = {
  parameters: {
    userStatus: { hasAnsweredToday: true, canAnswerQuestion: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Come back tomorrow/)).toBeInTheDocument();
    await expect(canvas.getByText(/Next question in/)).toBeInTheDocument();
  },
};

/** Catching up — active card shows catch-up banner */
export const CatchingUp: Story = {
  parameters: {
    userStatus: {
      hasAnsweredToday: false,
      canAnswerQuestion: true,
      questionsBehind: 5,
    },
  },
};

/** Force disabled — nothing renders in the active slot */
export const ForceDisabled: Story = {
  args: { forceDisabled: true },
  parameters: {
    userStatus: { hasAnsweredToday: false, canAnswerQuestion: true },
  },
};
