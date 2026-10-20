import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import FamilyFeud from './FamilyFeud';

const inTwoDays = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

const status = (currentRound: unknown, isMyTurn = false) => ({
  currentRound,
  isMyTurn,
  timesAsTarget: 1,
  neverGone: 2,
  totalPeople: 5,
  recentRounds: [],
});

const activeRound = (myGuess: string | null) => ({
  roundId: 'r1',
  targetUserId: 'bob',
  targetUserName: 'Bob',
  question: "What's Bob's favorite way to spend a Sunday?",
  status: 'active',
  startedAt: '2026-10-19T12:00:00.000Z',
  expiresAt: inTwoDays(),
  guessCount: myGuess ? 2 : 1,
  guessers: [{ userName: 'Carol', submittedAt: '2026-10-19T15:00:00.000Z' }],
  myGuess,
  choices: ['Fishing at the lake', 'A long bike ride', 'Cooking a big breakfast', 'Reading'],
  realAnswer: null,
  allGuesses: null,
  results: null,
});

const meta: Meta<typeof FamilyFeud> = {
  title: 'Home/FamilyFeud',
  component: FamilyFeud,
  parameters: { layout: 'padded' },
  args: { userId: 'alice' },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FamilyFeud>;

/** Nobody is up yet: anyone can go first. */
export const AnyoneCanStart: Story = {
  parameters: {
    msw: {
      handlers: [http.get('*/family-feud/status', () => HttpResponse.json(status(null, true)))],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: /I'll Go!/ })).toBeEnabled();
    await expect(canvas.getByText(/2 of 5 family members/)).toBeInTheDocument();
  },
};

/** A guess is saved, and the card asks for the round again to show it. */
export const Guessing: Story = {
  parameters: {
    msw: {
      handlers: (() => {
        let guess: string | null = null;
        return [
          http.get('*/family-feud/status', () => HttpResponse.json(status(activeRound(guess)))),
          http.post('*/family-feud/guess', async ({ request }) => {
            guess = ((await request.json()) as { guess: string }).guess;
            return HttpResponse.json({ guessCount: 2 });
          }),
        ];
      })(),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /A long bike ride/ }));
    await expect(await canvas.findByText(/Your guess is locked in/)).toBeInTheDocument();
  },
};
