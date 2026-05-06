// Visual preview of multiple HistoryCards stacked, as they appear in the carousel.
// Useful for checking card-to-card rhythm, spacing, and the color accent flow.

import { Box, Stack, Typography } from '@mui/material';
import React from 'react';

import HistoryCard from './HistoryCard';
import { StubTimelineProvider } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Trivia/Flow/CarouselPreview',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Visual preview of the carousel history stack. Verifies spacing and color rhythm when cards are viewed together.',
      },
    },
  },
  decorators: [
    (Story) => (
      <StubTimelineProvider>
        <div style={{ maxWidth: 400 }}><Story /></div>
      </StubTimelineProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj;

const mockHistory = [
  {
    question: 'Which planet has the most moons?',
    choices: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    answer: 'Saturn',
    selectedAnswer: 'Saturn',
    correct: true,
    category: 'Science & Nature',
    pointsEarned: 1,
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    question: 'In what year did the Berlin Wall fall?',
    choices: ['1987', '1989', '1991', '1993'],
    answer: '1989',
    selectedAnswer: '1991',
    correct: false,
    category: 'History',
    pointsEarned: 0,
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    question: 'What is the capital of Australia?',
    choices: ['Sydney', 'Melbourne', 'Canberra', 'Perth'],
    answer: 'Canberra',
    selectedAnswer: 'Canberra',
    correct: true,
    category: 'Geography',
    pointsEarned: 2,
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    question: 'Who wrote "To Kill a Mockingbird"?',
    choices: ['Harper Lee', 'Truman Capote', 'J.D. Salinger', 'John Steinbeck'],
    answer: 'Harper Lee',
    selectedAnswer: 'Harper Lee',
    correct: true,
    category: 'Literature',
    pointsEarned: 1,
    timestamp: new Date().toISOString(),
  },
];

export const HistoryStack: Story = {
  render: () => (
    <Stack spacing={2}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {mockHistory.length} cards in order (oldest → newest)
      </Typography>
      {mockHistory.map((h, i) => (
        <Box key={i}>
          <HistoryCard userId="alice" {...h} />
        </Box>
      ))}
    </Stack>
  ),
};

export const MixedResults: Story = {
  render: () => (
    <Stack spacing={2}>
      <HistoryCard
        userId="alice"
        question="Easy win"
        choices={['A', 'B', 'C', 'D']}
        answer="A"
        selectedAnswer="A"
        correct={true}
        category="Science"
        pointsEarned={1}
        timestamp={new Date().toISOString()}
      />
      <HistoryCard
        userId="alice"
        question="Tough miss"
        choices={['A', 'B', 'C', 'D']}
        answer="B"
        selectedAnswer="C"
        correct={false}
        category="History"
        pointsEarned={0}
        timestamp={new Date().toISOString()}
      />
      <HistoryCard
        userId="alice"
        question="Jackpot!"
        choices={['A', 'B', 'C', 'D']}
        answer="C"
        selectedAnswer="C"
        correct={true}
        category="Slot Machine"
        pointsEarned={10}
        timestamp={new Date().toISOString()}
      />
    </Stack>
  ),
};
