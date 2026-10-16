import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { PersonView } from '../model/people';
import { familyHomeHandlers } from './familyHomeMocks';
import { SpotlightCard } from './SpotlightCard';

const person = (over: Partial<PersonView> = {}): PersonView => ({
  id: 'jo',
  name: 'Jo',
  relation: 'cousin',
  homes: [{ id: 'dad', name: "Dad's house" }],
  remembered: false,
  died: null,
  paused: false,
  notPlaying: false,
  facts: 42,
  accuracy: 68,
  sinceYear: '2025',
  ...over,
});

const meta: Meta<typeof SpotlightCard> = {
  title: 'Family/SpotlightCard',
  component: SpotlightCard,
  args: {
    person: person(),
    next: person({ id: 'dave', name: 'Dave' }),
    meId: 'carol',
    onOpen: fn(),
  },
  parameters: { msw: { handlers: familyHomeHandlers() } },
};
export default meta;
type Story = StoryObj<typeof SpotlightCard>;

export const Today: Story = {};

export const FlipsToRoast: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Roast' }));
    await expect(await canvas.findByText(/never once been seen/)).toBeInTheDocument();
  },
};

/** Someone the family remembers: no roast, ever. */
export const Remembered: Story = {
  args: {
    person: person({
      id: 'grace',
      name: 'Grandma Grace',
      relation: 'grandparent',
      remembered: true,
      died: '2024-03-01',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Remembering')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Roast' })).toBeNull();
  },
};
