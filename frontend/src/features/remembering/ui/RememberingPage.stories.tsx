import type { FamilyPerson } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { exampleFamily } from '../../../test/fixtures/exampleFamily';
import { RememberingPage } from './RememberingPage';
import { rememberingHandlers } from './rememberingMocks';

const grace = exampleFamily.people.grace as FamilyPerson;
const names: Record<string, string> = { carol: 'Carol', bob: 'Bob' };

const meta: Meta<typeof RememberingPage> = {
  title: 'Family/RememberingPage',
  component: RememberingPage,
  args: {
    person: { ...grace, born: { date: '1938-04-02' } },
    topics: ['gardening', 'apple pie', 'the lake house'],
    nameOf: (id: string) => names[id] ?? id,
    onClose: fn(),
  },
  parameters: { layout: 'fullscreen', msw: { handlers: rememberingHandlers() } },
};
export default meta;
type Story = StoryObj<typeof RememberingPage>;

/** Her years and dedication, the last things she told us, then what the family loved. */
export const Remembering: Story = {
  play: async () => {
    const page = within(document.body);
    await expect(await page.findByText('1938 – 2024')).toBeInTheDocument();
    await expect(page.getByText('Always in the garden.')).toBeInTheDocument();
    await expect(
      await page.findByRole('heading', { name: 'The last things Grandma Grace told us' }),
    ).toBeInTheDocument();
    await expect(page.getByText(/7 answers shared · 88 trivia questions/)).toBeInTheDocument();
    await expect(page.getByText('6 reactions, 3 comments')).toBeInTheDocument();
    // What the family said about her, and what they wrote under her answers.
    await expect(
      page.getByRole('heading', { name: 'What the family said about Grandma Grace' }),
    ).toBeInTheDocument();
    await expect(page.getByText(/apple pie in the oven/)).toBeInTheDocument();
    await expect(page.getByRole('heading', { name: 'What we wrote back' })).toBeInTheDocument();
    await expect(page.getByText('We did, Grandma. Every Sunday.')).toBeInTheDocument();
  },
};

/** Sharing a memory adds it under the others. */
export const ShareAMemory: Story = {
  play: async () => {
    const page = within(document.body);
    const box = await page.findByLabelText('Share a memory of Grandma Grace');
    await userEvent.type(box, 'She taught me to whistle.');
    await userEvent.click(page.getByRole('button', { name: 'Share' }));
    await expect(await page.findByText('She taught me to whistle.')).toBeInTheDocument();
  },
};

/** Everything she shared opens month by month; the rest is one tap away. */
export const ReadEverything: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(await page.findByRole('button', { name: 'Read all 7 answers' }));
    // Her last words, what the family loved, what we wrote back, and the month it was said in.
    await expect(await page.findAllByText('“Call your sister more”')).toHaveLength(4);
    await expect(page.getByRole('heading', { name: 'February 2024' })).toBeInTheDocument();
  },
};

/** No date of birth: the day she died, written out. No answers: no book to make. */
export const OnlyTheDay: Story = {
  args: { person: { ...grace, born: undefined }, topics: [] },
  parameters: {
    msw: {
      handlers: rememberingHandlers(
        {
          personId: 'grace',
          words: [],
          last: [],
          loved: [],
          trivia: { played: 0, right: 0 },
          span: { first: null, last: null },
          mentions: [],
          replies: [],
        },
        [],
      ),
    },
  },
  play: async () => {
    const page = within(document.body);
    await expect(await page.findByText('March 1, 2024')).toBeInTheDocument();
    await expect(await page.findByText('No one has shared a memory yet.')).toBeInTheDocument();
    await expect(page.queryByRole('button', { name: /book/ })).toBeNull();
  },
};
