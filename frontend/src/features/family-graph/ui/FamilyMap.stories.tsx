import type { FamilyKnowledge, KnowledgeKind } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { exampleGraph as data } from '../../../test/fixtures/exampleFamily';
import { FamilyMap } from './FamilyMap';

const theme = (name: string, kind: KnowledgeKind, people: string[], says?: [string, string]) => ({
  name,
  kind,
  people,
  quotes: says ? [{ personId: says[0], says: says[1] }] : [],
});

/** A made-up family's index: what the example family talks about. */
const knowledge = {
  themes: [
    theme('the beach', 'place', ['carol', 'jo', 'alice', 'frank'], ['jo', 'beach with cousins']),
    theme('the lake house', 'place', ['grace', 'bob', 'ivy']),
    theme('grandma’s kitchen', 'place', ['carol', 'ivy', 'dave']),
    theme(
      'apple pie',
      'food',
      ['bob', 'ivy', 'grace'],
      ['grace', 'the one from my mother’s recipe'],
    ),
    theme('tacos', 'food', ['jo', 'frank', 'dave']),
    theme('pancakes on sunday', 'food', ['alice', 'erin']),
    theme('gardening', 'activity', ['grace', 'carol'], ['carol', 'birds in the garden']),
    theme('soccer', 'activity', ['dave', 'frank', 'jo']),
    theme('road trips', 'activity', ['bob', 'erin', 'alice']),
    theme('the dog', 'pet', ['carol', 'dave', 'frank', 'jo']),
    theme('moon river', 'media', ['grace', 'nan']),
    theme('board games', 'activity', ['erin', 'alice', 'nan']),
    theme('being there for each other', 'value', ['bob', 'carol', 'ivy', 'nan']),
    theme('the big snowstorm', 'memory', ['bob', 'ivy', 'grace']),
  ],
  people: {
    jo: { top: [{ name: 'skateboarding', kind: 'activity', count: 3 }], persona: null, stats: {} },
    nan: { top: [{ name: 'crosswords', kind: 'activity', count: 4 }], persona: null, stats: {} },
    hal: { top: [{ name: 'fishing', kind: 'activity', count: 2 }], persona: null, stats: {} },
  },
  stats: {},
} as unknown as FamilyKnowledge;

const meta: Meta<typeof FamilyMap> = {
  title: 'Family/FamilyMap',
  component: FamilyMap,
  args: { data, meId: 'carol', height: 600, knowledge, onOpenProfile: fn() },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof FamilyMap>;

export const OurMap: Story = {};

/** Before the family's answers have been read. */
export const NotReadYet: Story = {
  args: { knowledge: null },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Our map fills in as the family’s answers are read'),
    ).toBeInTheDocument();
    // The note never stands between a finger and the map.
    const note = within(canvasElement).getByTestId('map-not-read');
    await expect(getComputedStyle(note).pointerEvents).toBe('none');
  },
};

/** The map draws; nothing empty about it. */
export const Draws: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('canvas')).toBeTruthy());
    await expect(within(canvasElement).queryByText(/fills in/)).toBeNull();
    await userEvent.click(canvasElement);
  },
};
