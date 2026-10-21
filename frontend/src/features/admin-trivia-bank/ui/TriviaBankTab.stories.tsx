import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { TriviaBankTab } from './TriviaBankTab';

const answer = (data: unknown) => HttpResponse.json({ ok: true, data });

const STATS = {
  totalQuestions: 550,
  categories: [
    {
      category: 'History & Politics',
      count: 250,
      difficulties: { easy: 80, normal: 120, hard: 50 },
    },
    {
      category: 'Science & Nature',
      count: 300,
      difficulties: { easy: 100, normal: 150, hard: 50 },
    },
  ],
  sources: [
    ['opentdb', 400],
    ['custom', 150],
  ],
  questionsAsked: 512,
};

/** A page of whichever category was asked for. */
const browse = http.get('*/admin/trivia-bank/browse', ({ request }) => {
  const category = new URL(request.url).searchParams.get('category') ?? '';
  return answer({
    questions: [
      {
        question: `A question about ${category}?`,
        choices: ['A', 'B', 'C', 'D'],
        answer: 'A',
        category,
        difficulty: 'normal',
        source: 'opentdb',
      },
    ],
    total: 1,
  });
});

const handlers = [http.get('*/admin/trivia-bank/stats', () => answer(STATS)), browse];

const meta: Meta<typeof TriviaBankTab> = {
  title: 'Admin/TriviaBankTab',
  component: TriviaBankTab,
  parameters: {
    layout: 'padded',
    msw: { handlers },
    docs: {
      description: {
        component:
          'Admin › Trivia Bank: how many questions there are by category and difficulty, an ' +
          'import from a source or the AI, and a page at a time to browse. An import or a ' +
          'delete is sent once and asks for the numbers again.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TriviaBankTab>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('550 questions')).toBeInTheDocument();
    await expect(canvas.getByText('512 asked')).toBeInTheDocument();
    await expect(canvas.getByText('opentdb: 400')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/admin/trivia-bank/stats', async () => {
          await delay('infinite');
          return answer(STATS);
        }),
      ],
    },
  },
};

/** A category's row opens its first page at once. */
export const BrowseFromTheTable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Science & Nature'));
    await expect(await canvas.findByText('A question about Science & Nature?')).toBeInTheDocument();
    await expect(canvas.getByText('Showing 1-1 of 1')).toBeInTheDocument();
  },
};

/** An import says what it fetched, added, and already had. */
export const Imported: Story = {
  parameters: {
    msw: {
      handlers: [
        ...handlers,
        http.post('*/admin/trivia-bank/import', () =>
          answer({
            source: 'AI: Springfield',
            category: 'Springfield',
            difficulty: 'normal',
            fetched: 20,
            added: 18,
            duplicates: 2,
            errors: 0,
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText('550 questions');
    await userEvent.click(canvas.getAllByRole('combobox')[0] as HTMLElement);
    await userEvent.click(await body.findByRole('option', { name: /AI: Springfield/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Import' }));
    await expect(await canvas.findByText(/Fetched 20, Added 18/)).toBeInTheDocument();
  },
};

/** The server turns an import down: it says why, above the bank. */
export const ImportTurnedDown: Story = {
  parameters: {
    msw: {
      handlers: [
        ...handlers,
        http.post('*/admin/trivia-bank/import', () =>
          HttpResponse.json({ ok: false, error: 'Import failed' }, { status: 500 }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText('550 questions');
    await userEvent.click(canvas.getAllByRole('combobox')[0] as HTMLElement);
    await userEvent.click(await body.findByRole('option', { name: /AI: Springfield/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Import' }));
    await expect(await canvas.findByText('Import failed')).toBeInTheDocument();
  },
};
