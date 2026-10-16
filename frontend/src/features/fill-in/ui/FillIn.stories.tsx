import type { FillInItem, FillInView } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { FillIn } from './FillIn';

const item = (key: string, question: string, over: Partial<FillInItem>): FillInItem => ({
  key,
  questionType: 'shared',
  date: key.slice(7),
  question,
  answer: null,
  words: 0,
  familyWords: 14,
  familyAnswered: 7,
  state: 'missing',
  added: 0,
  ...over,
});

const view: FillInView = {
  items: [
    item('shared:2026-03-02', 'What always makes you smile?', {}),
    item('shared:2026-02-20', 'What app would you miss the most?', { state: 'skipped' }),
    item('shared:2026-02-11', 'Describe your perfect Sunday.', {
      state: 'brief',
      answer: 'Coffee.',
      words: 1,
    }),
  ],
  suggested: ['shared:2026-03-02', 'shared:2026-02-20', 'shared:2026-02-11'],
  summary: { answered: 41, total: 58, yourWords: 6, familyWords: 13, depth: 'shorter' },
};

const meta: Meta<typeof FillIn> = {
  title: 'Profile/FillIn',
  component: FillIn,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get('*/fill-in', () => HttpResponse.json({ ok: true, data: view })),
        http.put('*/fill-in', () =>
          HttpResponse.json({ ok: true, data: { key: 'k', fact: 'A fun fact.' } }),
        ),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof FillIn>;

export const Summary: Story = {};

export const ThroughTheDeck: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Start · 3' }));
    const page = within(document.body);
    await userEvent.type(
      await page.findByRole('textbox', { name: 'What always makes you smile?' }),
      'The birds',
    );
    await userEvent.click(page.getByRole('button', { name: 'Save and next' }));
    await expect(await page.findByText('You skipped this one')).toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Not now' }));
    await expect(await page.findByText('Say a little more?')).toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Not now' }));
    await expect(await page.findByText('1 more for the family’s story')).toBeInTheDocument();
  },
};
