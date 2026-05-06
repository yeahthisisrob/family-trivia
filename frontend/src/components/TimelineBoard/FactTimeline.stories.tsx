import { fn } from 'storybook/test';

import FactTimeline from './FactTimeline';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const sampleFacts = [
  {
    userId: 'alice',
    username: 'Alice',
    groupId: 'parents',
    familySide: 'side1',
    date: '2026-04-10',
    question: "What's your favorite family tradition?",
    answer: 'Sunday brunch — we all cook together',
    fact: 'Shared meals strengthen family bonds across generations.',
    timestamp: '2026-04-10T14:30:00.000Z',
    answered: true,
    skipped: false,
    questionType: 'shared' as const,
  },
  {
    userId: 'bob',
    username: 'Bob',
    groupId: 'parents',
    familySide: 'side1',
    date: '2026-04-09',
    question: 'What small thing made you feel lucky this week?',
    answer: 'Found a parking spot on the first try',
    fact: 'Noticing small wins builds lasting positive affect.',
    timestamp: '2026-04-09T10:15:00.000Z',
    answered: true,
    skipped: false,
    questionType: 'shared' as const,
  },
];

const meta: Meta<typeof FactTimeline> = {
  title: 'TimelineBoard/FactTimeline',
  component: FactTimeline,
  parameters: { layout: 'padded' },
  args: {
    facts: sampleFacts,
    currentUserId: 'alice',
    onUserClick: fn(),
    selectedSide: 'all',
  },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof FactTimeline>;

export const Default: Story = {};

export const Empty: Story = {
  args: { facts: [] },
};
