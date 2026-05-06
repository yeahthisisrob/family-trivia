import React from 'react';
import { expect, userEvent, within } from 'storybook/test';

import StatusGridToggle from './StatusGridToggle';
import { StoryProviders } from '../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof StatusGridToggle> = {
  title: 'Home/StatusGridToggle',
  component: StatusGridToggle,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Toggle between the Facts answer grid and the Trivia answer grid on the home tab. Both grids show the family answer matrix — users switch between them without changing tabs.',
      },
    },
  },
  args: {
    userId: 'alice',
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof StatusGridToggle>;

/** Default — starts on Facts grid */
export const DefaultFacts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Facts toggle should be selected by default
    const factsBtn = canvas.getByText('Facts');
    await expect(factsBtn.closest('button')).toHaveAttribute('aria-pressed', 'true');
  },
};

/** Switch to Trivia grid */
export const SwitchToTrivia: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triviaBtn = canvas.getByText('Trivia');
    await userEvent.click(triviaBtn);
    await expect(triviaBtn.closest('button')).toHaveAttribute('aria-pressed', 'true');
  },
};
