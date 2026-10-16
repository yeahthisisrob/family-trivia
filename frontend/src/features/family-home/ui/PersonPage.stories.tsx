import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { exampleGraph } from '../../../test/fixtures/exampleFamily';
import { familyHomeHandlers, KNOWLEDGE } from './familyHomeMocks';
import { PersonPage } from './PersonPage';

const meta: Meta<typeof PersonPage> = {
  title: 'Family/PersonPage',
  component: PersonPage,
  args: {
    meId: 'carol',
    likenesses: exampleGraph.likenesses,
    onClose: fn(),
    person: {
      id: 'jo',
      name: 'Jo',
      relation: 'cousin',
      homes: [],
      remembered: false,
      died: null,
      paused: false,
      notPlaying: false,
      facts: 42,
      accuracy: 68,
      sinceYear: '2025',
    },
  },
  parameters: { msw: { handlers: familyHomeHandlers() } },
};
export default meta;
type Story = StoryObj<typeof PersonPage>;

export const About: Story = {};

/** With the family's index: the persona, what they talk about, their longest run. */
export const AboutFromTheIndex: Story = {
  args: { known: KNOWLEDGE.people.jo },
  play: async () => {
    const page = within(document.body);
    await expect(await page.findByText(/happiest near water/)).toBeInTheDocument();
    await expect(page.getByText('Often talks about')).toBeInTheDocument();
    await expect(page.getByText('9 days')).toBeInTheDocument();
  },
};

export const YouAndThem: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(await page.findByRole('tab', { name: 'You & them' }));
    await expect(await page.findByText(/answered 7 questions alike/)).toBeInTheDocument();
  },
};

export const InTheirWords: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(await page.findByRole('tab', { name: 'In their words' }));
    await expect(await page.findByText('“This one”')).toBeInTheDocument();
  },
};

export const Remembered: Story = {
  args: {
    dedication: 'Always in the garden.',
    person: {
      id: 'grace',
      name: 'Grandma Grace',
      relation: 'grandparent',
      homes: [],
      remembered: true,
      died: '2024-03-01',
      paused: false,
      notPlaying: false,
      facts: 120,
      accuracy: null,
      sinceYear: '2025',
    },
  },
};
