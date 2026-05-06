import React from 'react';
import { fn } from 'storybook/test';

import { SlotMachine } from './SlotMachine';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const installMockFetch = () => {
  const realFetch = window.fetch;

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/slot-machine/spin') && !url.includes('arcade')) {
      await new Promise(r => setTimeout(r, 500));
      return new Response(JSON.stringify({
        ok: true,
        data: {
          result: { multiplier: 3, category: 'Science & Nature', isPersonalQuestion: false },
          bonusFeatures: {},
          currentStreak: 1,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/slot-machine/question')) {
      await new Promise(r => setTimeout(r, 800));
      return new Response(JSON.stringify({
        ok: true,
        data: {
          question: { question: 'What is the chemical symbol for gold?', choices: ['Au', 'Ag', 'Fe', 'Cu'], category: 'Science', isPersonal: false },
          multiplier: 3,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/slot-machine/answer') && !url.includes('arcade')) {
      const body = JSON.parse((init?.body as string) || '{}');
      const correct = body.answer === 'Au';
      return new Response(JSON.stringify({
        ok: true,
        data: { correct, correctAnswer: 'Au', pointsEarned: correct ? 3 : 0, multiplier: 3, newStreak: correct ? 2 : 0 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/slot-machine/arcade-spin')) {
      await new Promise(r => setTimeout(r, 300));
      const symbols = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎', '🍀'];
      const pick = () => symbols[Math.floor(Math.random() * symbols.length)];
      const reels = [pick(), pick(), pick()];
      const match = reels[0] === reels[1] && reels[1] === reels[2];
      const partial = !match && (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]);
      return new Response(JSON.stringify({
        ok: true,
        data: {
          reels, payout: match ? 25 : partial ? 2 : 0,
          multiplier: match ? 25 : partial ? 2 : 0,
          matchType: match ? 'jackpot' : partial ? 'partial' : 'none',
          betAmount: 1,
          reelStrips: [[pick(), reels[0], pick()], [pick(), reels[1], pick()], [pick(), reels[2], pick()]],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/casino/balance')) {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true, data: { balance: 42, floor: 35 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: true, data: { balance: 42, floor: 35 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/slot-machine/balance')) {
      return new Response(JSON.stringify({ ok: true, data: { balance: 42 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/slot-machine/status')) {
      return new Response(JSON.stringify({
        ok: true, data: { canPlay: true, activeSession: null, stats: { totalPlays: 10, totalWins: 5, bestStreak: 3, currentStreak: 1, averageMultiplier: 2.5, jackpotWins: 1, winRate: 50 } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return realFetch(input, init);
  };
  return () => { window.fetch = realFetch; };
};

const meta: Meta<typeof SlotMachine> = {
  title: 'Trivia/Game Modes/SlotMachine',
  component: SlotMachine,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Slot machine with real CSS spinning reels. Trivia mode: weekly, multiplier + question. Arcade mode: unlimited, bet-based payouts with balance from trivia points.',
      },
    },
  },
  args: {
    userId: 'storybook-user',
    groupId: 'storybook-group',
    isCatchingUp: false,
    onClose: fn(),
    onComplete: fn(),
  },
  decorators: [
    (Story) => {
      React.useEffect(() => installMockFetch(), []);
      return (
        <StoryProviders>
          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            <Story />
          </div>
        </StoryProviders>
      );
    },
  ],
};
export default meta;
type Story = StoryObj<typeof SlotMachine>;

/** Trivia mode — pull lever to spin, answer a question for multiplied points */
export const TriviaMode: Story = {
  args: { mode: 'trivia' },
};

/** Arcade mode — bet and spin for payouts, balance starts from trivia points */
export const ArcadeMode: Story = {
  args: { mode: 'arcade' },
};

/** Interactive trivia — full flow: spin → question → answer */
export const InteractiveTrivia: Story = {
  args: { mode: 'trivia' },
  parameters: {
    docs: { description: { story: 'Pull the lever or click SPIN to play. Reels spin with staggered stops. Answer trivia to earn multiplied points.' } },
  },
};

/** Interactive arcade — bet, spin, win or bust */
export const InteractiveArcade: Story = {
  args: { mode: 'arcade' },
  parameters: {
    docs: { description: { story: 'Set your bet, pull the lever. Match symbols for payouts (🍀=50x!). Play until you bust or quit while ahead.' } },
  },
};

/** Close button */
export const CloseButton: Story = {
  args: { mode: 'trivia', onClose: fn() },
};
