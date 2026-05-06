import React from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import CurlingGame from './CurlingGame';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Stub fetch for curling endpoints so the full game flow (throw → lock →
// question → answer) is playable in Storybook without a backend.
const installMockFetch = () => {
  const realFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/curling/lock')) {
      const body = JSON.parse((init?.body as string) || '{}');
      return new Response(JSON.stringify({
        multiplier: body.multiplier,
        question: {
          question: 'What is the longest river in the world?',
          choices: ['Nile', 'Amazon', 'Yangtze', 'Mississippi'],
          category: 'Geography & Travel',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/curling/answer')) {
      const body = JSON.parse((init?.body as string) || '{}');
      const correct = body.answer === 'Nile';
      return new Response(JSON.stringify({
        correct,
        correctAnswer: 'Nile',
        pointsEarned: correct ? 3 : 0,
        multiplier: 3,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  };
  return () => { window.fetch = realFetch; };
};

const meta: Meta<typeof CurlingGame> = {
  title: 'Trivia/Game Modes/CurlingGame',
  component: CurlingGame,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'Weekly curling game mode. Mobile-focused, hold-to-charge launch with',
          'timed sweet spot, tap-to-sweep physics, and a classic curling house',
          'as the target.',
          '',
          'Rings (by final stone distance from house center):',
          '- Button (bullseye): 3×',
          '- Inner ring: 2×',
          '- Outer ring: 1×',
          '- Outside the house: 0.5×',
        ].join('\n'),
      },
    },
  },
  args: {
    userId: 'storybook-user',
    isCatchingUp: false,
    onClose: fn(),
    onComplete: fn(),
  },
  decorators: [
    (Story) => {
      React.useEffect(() => installMockFetch(), []);
      return <div style={{ maxWidth: 320, margin: '0 auto' }}><Story /></div>;
    },
  ],
};
export default meta;
type Story = StoryObj<typeof CurlingGame>;

export const Idle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('CURLING')).toBeInTheDocument();
    await expect(canvas.getByText('Drag upward to aim and shoot')).toBeInTheDocument();
  },
};

export const InteractiveDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Drag the stone upward to aim and set power, release to launch, then tap the ice to sweep.',
      },
    },
  },
};

export const CloseButtonFiresOnClose: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const closeBtn = canvas.getByTestId('CloseIcon').closest('button')!;
    await userEvent.click(closeBtn);
    await expect(args.onClose).toHaveBeenCalled();
  },
};
