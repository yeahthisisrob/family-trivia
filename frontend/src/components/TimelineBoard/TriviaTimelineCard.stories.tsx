import { fn } from 'storybook/test';

import TriviaTimelineCard from './TriviaTimelineCard';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const baseEntry = {
  userId: 'alice',
  color: '#2196F3',
  initials: 'A',
  question: 'Which planet has the most moons in our solar system?',
  choices: ['Earth', 'Jupiter', 'Saturn', 'Neptune'],
  answer: 'Saturn',
  selectedAnswer: 'Saturn',
  correct: true,
  timestamp: '2026-04-10T14:30:00.000Z',
  group: 'parents',
};

const meta: Meta<typeof TriviaTimelineCard> = {
  title: 'TimelineBoard/TriviaTimelineCard',
  component: TriviaTimelineCard,
  parameters: { layout: 'padded' },
  args: { entry: baseEntry, onUserClick: fn() },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof TriviaTimelineCard>;

export const Correct: Story = {};
export const Incorrect: Story = {
  args: { entry: { ...baseEntry, selectedAnswer: 'Jupiter', correct: false } },
};
export const Grouped: Story = {
  args: { isGrouped: true },
};
