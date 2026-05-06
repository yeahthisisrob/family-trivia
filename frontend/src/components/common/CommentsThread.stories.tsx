import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import CommentsThread from './CommentsThread';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const getUserColor = (userId: string) => {
  const colors = ['#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#FFC107'];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const getUserInitials = (userId: string) =>
  userId.slice(0, 2).toUpperCase();

const meta: Meta<typeof CommentsThread> = {
  title: 'Common/CommentsThread',
  component: CommentsThread,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Unified comment thread for trivia answers and daily facts. Reads/writes via TimelineContext. Supports replies, user avatars, batch count badges, and a 100-char limit.',
      },
    },
  },
  args: {
    currentUserId: 'alice',
    getUserColor,
    getUserInitials,
  },
  argTypes: {
    getUserColor: { table: { disable: true } },
    getUserInitials: { table: { disable: true } },
  },
  decorators: [
    (Story, context) => (
      <StoryProviders timeline={context.parameters.timeline}>
        <div style={{ maxWidth: 420, background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CommentsThread>;

// ── Stories ────────────────────────────────────────────────────────

export const NoComments: Story = {
  args: { contentId: 'alice_2026-04-05T12:00:00Z', contentType: 'trivia' },
  parameters: {
    timeline: { triviaComments: {} },
  },
};

export const WithComments: Story = {
  args: {
    contentId: 'alice_2026-04-05T12:00:00Z',
    contentType: 'trivia',
  },
  parameters: {
    timeline: {
      triviaComments: {
        'alice_2026-04-05T12:00:00Z': [
          { id: 'c1', userId: 'bob', text: 'Nice one!', timestamp: new Date(Date.now() - 3600_000).toISOString() },
          { id: 'c2', userId: 'carol', text: 'I got this wrong', timestamp: new Date(Date.now() - 1800_000).toISOString() },
          { id: 'c3', userId: 'alice', text: 'Thanks!', timestamp: new Date(Date.now() - 600_000).toISOString() },
        ],
      },
    },
  },
};

export const WithReplies: Story = {
  args: {
    contentId: 'bob_2026-04-05T14:00:00Z',
    contentType: 'trivia',
  },
  parameters: {
    timeline: {
      triviaComments: {
        'bob_2026-04-05T14:00:00Z': [
          { id: 'c1', userId: 'alice', text: 'Tricky question.', timestamp: new Date(Date.now() - 7200_000).toISOString() },
          { id: 'c2', userId: 'bob', text: 'Right? Took me forever.', timestamp: new Date(Date.now() - 3600_000).toISOString(), parentId: 'c1' },
          { id: 'c3', userId: 'carol', text: 'I had no idea either', timestamp: new Date(Date.now() - 1800_000).toISOString(), parentId: 'c1' },
        ],
      },
    },
  },
};

export const TypingAndSubmit: Story = {
  args: {
    contentId: 'alice_2026-04-05T12:00:00Z',
    contentType: 'trivia',
    textOverrides: { placeholderText: 'That was a tough one...' },
  },
  parameters: {
    timeline: {
      triviaComments: {},
      onAddComment: fn(),
    },
  },
  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement);
    // Expand comments by clicking the "Add a comment" trigger
    const toggle = canvas.getByText('Add a comment');
    await userEvent.click(toggle);
    // Type a comment
    const input = await canvas.findByPlaceholderText('That was a tough one...');
    await userEvent.type(input, 'Great question!');
    // Submit via Enter key
    await userEvent.keyboard('{Enter}');

    await waitFor(async () => {
      await expect(parameters.timeline.onAddComment).toHaveBeenCalledWith(
        'alice',
        'alice_2026-04-05T12:00:00Z',
        'Great question!',
      );
    });
  },
};

export const CustomPlaceholder: Story = {
  args: {
    contentId: 'alice_fact_2026-04-05',
    contentType: 'fact',
    textOverrides: { placeholderText: 'What are your thoughts?' },
  },
  parameters: { timeline: { factComments: {} } },
};

export const EmptyFactComments: Story = {
  args: {
    contentId: 'alice_fact_2026-04-05',
    contentType: 'fact',
  },
  parameters: { timeline: { factComments: {} } },
};

/** Shows the count badge on a collapsed thread (batch counts, no full fetch). */
export const BadgeWithCounts: Story = {
  args: {
    contentId: 'alice_2026-04-05T12:00:00Z',
    contentType: 'trivia',
  },
  parameters: {
    timeline: {
      triviaComments: {
        'alice_2026-04-05T12:00:00Z': [
          { id: 'c1', userId: 'bob', text: 'Great!', timestamp: new Date().toISOString() },
          { id: 'c2', userId: 'carol', text: 'Agreed', timestamp: new Date().toISOString() },
          { id: 'c3', userId: 'alice', text: 'Thanks', timestamp: new Date().toISOString() },
        ],
      },
    },
  },
};
