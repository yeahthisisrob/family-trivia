import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { EditAnswers } from './EditAnswers';

const ok = (data: unknown) => HttpResponse.json({ ok: true, data });

/** Carol's made-up answers: one shared question answered, one missed. */
const answered = {
  question: 'What always makes you smile?',
  answer: 'The birds at the feeder',
  fact: 'Some feeder birds remember which feeders are filled first.',
  date: '2026-10-12',
  questionType: 'shared',
  answered: true,
  timestamp: '2026-10-12T15:00:00.000Z',
};

const handlers = () => {
  let saved: string | null = null;
  return [
    http.get('*/user-fact-history', () =>
      ok({
        history: [
          answered,
          ...(saved
            ? [{ ...answered, question: 'Best road trip?', answer: saved, date: '2026-10-13' }]
            : []),
        ],
        basicQuestions: [],
        basicQuestionsTotal: 0,
        allSharedQuestions: [
          { question: answered.question, date: answered.date, questionType: 'shared' },
          { question: 'Best road trip?', date: '2026-10-13', questionType: 'shared' },
        ],
      }),
    ),
    http.post('*/submit-historical-fact', async ({ request }) => {
      saved = ((await request.json()) as { answer: string }).answer;
      return ok({ success: true, fact: 'Road trips stay with a family for years.' });
    }),
  ];
};

const meta: Meta<typeof EditAnswers> = {
  title: 'Profile/EditAnswers',
  component: EditAnswers,
  args: { userId: 'carol' },
  parameters: { layout: 'padded', msw: { handlers: handlers() } },
};
export default meta;
type Story = StoryObj<typeof EditAnswers>;

/** Every question so far, the answered ones and the one missed. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('1 Answered')).toBeInTheDocument();
    await expect(canvas.getByText('1 Unanswered')).toBeInTheDocument();
  },
};

/** Answering a missed question: once saved, it counts as answered. */
export const AnswerOneMissed: Story = {
  parameters: { msw: { handlers: handlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Best road trip?'));
    await userEvent.click(await canvas.findByRole('button', { name: 'Answer This Question' }));
    await userEvent.type(canvas.getByLabelText('Your Answer'), 'The coast, all of us');
    await userEvent.click(canvas.getByRole('button', { name: 'Save Answer' }));
    await expect(await canvas.findByText('2 Answered')).toBeInTheDocument();
  },
};
