import React from 'react';
import { expect, userEvent, within } from 'storybook/test';

import MemberSpotlight from './MemberSpotlight';

import type { MockSummary } from './MemberSpotlight';
import type { FamilyHierarchy } from '../../api';
import type { Meta, StoryObj } from '@storybook/react-vite';

// ── Mock hierarchy ───────────────────────────────────────────────────

const mockHierarchy: FamilyHierarchy = {
  version: '1.0',
  family: {
    name: 'Demo Family',
    root: { partners: [] },
    relationships: [],
    sides: {
      paternal: { color: '#2196F3', groups: ['smiths'] },
      maternal: { color: '#FF9800', groups: ['johnsons'] },
    },
    groups: {
      smiths: { name: 'The Smiths', members: ['alice', 'bob', 'carol'] },
      johnsons: { name: 'The Johnsons', members: ['dave', 'eve'] },
    },
    people: {
      alice: { name: 'Alice Smith', groupId: 'smiths', familySide: 'paternal' },
      bob: { name: 'Bob Smith', groupId: 'smiths', familySide: 'paternal' },
      carol: { name: 'Carol Smith', groupId: 'smiths', familySide: 'paternal' },
      dave: { name: 'Dave Johnson', groupId: 'johnsons', familySide: 'maternal' },
      eve: { name: 'Eve Johnson', groupId: 'johnsons', familySide: 'maternal' },
    },
  },
} as any;

// ── Mock summaries ───────────────────────────────────────────────────

const mockSummaries: Record<string, MockSummary> = {
  alice: {
    regular:
      'Alice is the family trivia champion with an impressive 87% accuracy rate. She dominates in History and Geography categories and has maintained a 12-day answer streak. Known for her competitive spirit, she never misses a daily question.',
    roast:
      'Alice treats family trivia like it\'s a doctoral thesis defense. She has spreadsheets tracking everyone\'s weak categories. We get it, Alice, you watch Jeopardy.',
    basicQAs: [
      { question: 'What is your favorite holiday tradition?', answer: 'Making gingerbread houses on Christmas Eve' },
      { question: 'What did you want to be growing up?', answer: 'An astronaut or a veterinarian' },
      { question: 'What is your go-to comfort food?', answer: 'Mom\'s homemade mac and cheese' },
      { question: 'Favorite family vacation memory?', answer: 'Road trip to Yellowstone in 2019' },
      { question: 'Hidden talent?', answer: 'Can solve a Rubik\'s cube in under 2 minutes' },
    ],
    insights: [
      { text: 'History buff', category: 'preference' },
      { text: 'Competitive streak', category: 'personality' },
      { text: '87% accuracy', category: 'fact' },
      { text: 'Daily player', category: 'activity' },
      { text: 'Close with Carol', category: 'relationship' },
    ],
  },
  bob: {
    regular:
      'Bob brings the laughs to every trivia session. While his accuracy hovers around 62%, he makes up for it with enthusiasm. His strongest category is Pop Culture, and he holds the record for most Casino Rush attempts in a single week.',
    roast:
      'Bob\'s trivia strategy is "click fast and hope for the best." His Pop Culture knowledge peaked in 2005 and he still thinks The Office references count as personality traits.',
    basicQAs: [
      { question: 'Favorite weekend activity?', answer: 'Grilling and watching football' },
      { question: 'What are you most proud of?', answer: 'Teaching the kids to ride bikes' },
    ],
    insights: [
      { text: 'Pop Culture expert', category: 'preference' },
      { text: 'Class clown', category: 'personality' },
      { text: 'Casino Rush addict', category: 'activity' },
    ],
  },
  carol: {
    regular:
      'Carol is the quiet achiever of the family. She rarely misses a daily fact submission and her answers are always thoughtful and detailed. Science & Nature is her strongest category at 91% accuracy.',
    roast:
      'Carol writes daily fact answers like she\'s submitting a peer-reviewed paper. Nobody asked for citations, Carol.',
    insights: [
      { text: 'Science whiz', category: 'preference' },
      { text: 'Detail-oriented', category: 'personality' },
      { text: '91% in Science', category: 'fact' },
    ],
  },
  dave: {
    regular:
      'Dave joined the family trivia game late but has been climbing the leaderboard fast. His Sports & Games knowledge is unmatched in the family, and he recently won three Casino Rush games in a row.',
    roast:
      'Dave memorized every Super Bowl winner but still can\'t remember his anniversary. Priorities, Dave.',
    basicQAs: [
      { question: 'Dream vacation destination?', answer: 'Watching the World Cup in person' },
    ],
    insights: [
      { text: 'Sports encyclopedia', category: 'preference' },
      { text: '3x Casino Rush winner', category: 'activity' },
      { text: 'Rising star', category: 'fact' },
    ],
  },
  eve: {
    regular:
      'Eve is the heart of the Johnson side. She consistently submits the most heartfelt daily facts and her comments always spark great family conversations. Literature & Arts is her domain.',
    roast:
      'Eve comments on every single daily fact like she\'s writing a Hallmark card. We love you too, Eve, but please stop using so many heart emojis.',
    insights: [
      { text: 'Literature lover', category: 'preference' },
      { text: 'Most comments', category: 'activity' },
      { text: 'Family connector', category: 'relationship' },
    ],
  },
};

// ── Meta ─────────────────────────────────────────────────────────────

const meta: Meta<typeof MemberSpotlight> = {
  title: 'FamilyTree/MemberSpotlight',
  component: MemberSpotlight,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'AI-generated member spotlight with carousel navigation, normal/roast toggle, quick-fact chips, and Q&A highlights. Loads data lazily per member+mode with circuit-breaker error handling.',
      },
    },
  },
  args: {
    hierarchy: mockHierarchy,
    currentUserId: 'alice',
    onMemberClick: () => {},
    __mockSummaries: mockSummaries,
  },
  argTypes: {
    currentUserId: {
      control: 'select',
      options: ['alice', 'bob', 'carol', 'dave', 'eve'],
    },
    onMemberClick: { action: 'memberClicked' },
    __mockSummaries: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, margin: '0 auto', background: '#f5f5f5', padding: 16, borderRadius: 12, minHeight: 200 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof MemberSpotlight>;

// ── Stories ──────────────────────────────────────────────────────────

/** Full spotlight with summary, insights, and Q&A */
export const WithSummary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Alice Smith')).toBeInTheDocument();
    await expect(canvas.getByText('Member Spotlight')).toBeInTheDocument();
    await expect(canvas.getByText(/trivia champion/)).toBeInTheDocument();
    await expect(canvas.getByText('Quick Facts')).toBeInTheDocument();
    await expect(canvas.getByText('History buff')).toBeInTheDocument();
    await expect(canvas.getByText('Q&A Highlights')).toBeInTheDocument();
  },
};

/** Toggling to roast mode shows the roast summary */
export const RoastMode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the roast toggle
    const toggle = canvas.getByRole('checkbox');
    await userEvent.click(toggle);
    await expect(canvas.getByText(/spreadsheets tracking/)).toBeInTheDocument();
  },
};

/** Member with fewer details (no Q&As) */
export const MinimalData: Story = {
  args: { currentUserId: 'carol' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Carol Smith')).toBeInTheDocument();
    await expect(canvas.getByText(/quiet achiever/)).toBeInTheDocument();
    // Carol has insights but no QAs
    await expect(canvas.getByText('Science whiz')).toBeInTheDocument();
    await expect(canvas.queryByText('Q&A Highlights')).not.toBeInTheDocument();
  },
};

/** Navigate to a different member via arrows */
export const NavigateCarousel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Alice Smith')).toBeInTheDocument();
    // Click next arrow
    const nextBtn = canvas.getAllByRole('button').find(
      (btn) => btn.querySelector('[data-testid="ChevronRightIcon"]'),
    );
    if (nextBtn) await userEvent.click(nextBtn);
    await expect(canvas.getByText('Bob Smith')).toBeInTheDocument();
    await expect(canvas.getByText(/brings the laughs/)).toBeInTheDocument();
  },
};

/** Maternal side member gets orange accent */
export const MaternalSide: Story = {
  args: { currentUserId: 'eve' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Eve Johnson')).toBeInTheDocument();
    await expect(canvas.getByText(/heart of the Johnson/)).toBeInTheDocument();
    await expect(canvas.getByText('Literature lover')).toBeInTheDocument();
  },
};

/** Shows "+1 more" when there are more than 4 Q&As */
export const ManyQAs: Story = {
  args: { currentUserId: 'alice' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Alice has 5 QAs, only 4 shown
    await expect(canvas.getByText('+1 more')).toBeInTheDocument();
  },
};

/** Error state when no mock data exists for a member */
export const ErrorState: Story = {
  args: {
    __mockSummaries: {}, // Empty mocks = all members get error state
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/coming soon/)).toBeInTheDocument();
  },
};

/** Loading state (no mocks at all) */
export const Loading: Story = {
  args: {
    __mockSummaries: undefined,
  },
  parameters: {
    docs: { description: { story: 'Without mock data, the component shows skeletons while calling the real API.' } },
  },
};
