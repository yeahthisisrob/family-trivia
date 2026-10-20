import StarIcon from '@mui/icons-material/Star';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { gameLook } from '../../games/kit';
import { StoryProviders } from '../../test/storyContexts';
import GameModeCard from './GameModeCard';

const baseEntry = {
  userId: 'alice',
  color: '#2196F3',
  initials: 'A',
  question: 'Which planet has the most moons?',
  choices: ['Earth', 'Jupiter', 'Saturn', 'Neptune'],
  answer: 'Saturn',
  selectedAnswer: 'Saturn',
  correct: true,
  timestamp: '2026-04-10T14:30:00.000Z',
  group: 'parents',
};

// Made-up session games: the card reads everything from the game.
const triple = {
  id: 'triple-dare',
  label: 'Triple Dare',
  description: 'Three questions, all or nothing',
  badge: 'ALL OR NOTHING',
  icon: StarIcon,
  look: gameLook(20),
  session: { result: (won: boolean) => (won ? 'JACKPOT' : 'BUSTED') },
};
const spinner = { ...triple, id: 'spinner', label: 'Spinner', look: gameLook(280), session: {} };

const meta: Meta<typeof GameModeCard> = {
  title: 'TimelineBoard/GameModeCard',
  component: GameModeCard,
  parameters: { layout: 'padded' },
  args: {
    game: triple,
    entries: [baseEntry, baseEntry, baseEntry],
    userId: 'alice',
    color: '#2196F3',
    initials: 'A',
    group: 'parents',
    timestamp: '2026-04-10T14:30:00.000Z',
    totalPoints: 9,
    onUserClick: fn(),
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof GameModeCard>;

export const AllCorrect: Story = {};
export const Failed: Story = {
  args: {
    entries: [baseEntry, { ...baseEntry, selectedAnswer: 'Jupiter', correct: false }, baseEntry],
    totalPoints: 0,
  },
};
export const WithMultiplier: Story = {
  args: { game: spinner, entries: [baseEntry], multiplier: 2, totalPoints: 2 },
};
