import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { DailyQuestionsTab } from './DailyQuestionsTab';

const question = (date: string, text: string, createdBy: string) => ({
  key: `facts/daily/shared/${date}.json`,
  date,
  question: text,
  createdBy,
  answered: false,
});

const questions = (list: unknown[]) =>
  http.get('*/admin/daily-questions', () =>
    HttpResponse.json({ ok: true, data: { questions: list } }),
  );

const meta: Meta<typeof DailyQuestionsTab> = {
  title: 'Admin/DailyQuestionsTab',
  component: DailyQuestionsTab,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        questions([
          question(
            '2026-04-09',
            'If you could travel anywhere tomorrow, where would you go?',
            'bob',
          ),
          question('2026-04-10', "What's your favorite memory from this week?", 'alice'),
        ]),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof DailyQuestionsTab>;

/** Newest first. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = await canvas.findByText("What's your favorite memory from this week?");
    const second = canvas.getByText(/travel anywhere tomorrow/);
    await expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};

export const Empty: Story = {
  parameters: { msw: { handlers: [questions([])] } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No daily questions yet'),
    ).toBeInTheDocument();
  },
};

/** Deleting asks first and says what goes with it; cancelling deletes nothing. */
export const DeleteAsksFirst: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText("What's your favorite memory from this week?");
    await userEvent.click(canvas.getAllByTestId('DeleteIcon')[0] as HTMLElement);
    await expect(
      await body.findByText(/remove all user answers for that date/),
    ).toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByText("What's your favorite memory from this week?")).toBeVisible();
  },
};
