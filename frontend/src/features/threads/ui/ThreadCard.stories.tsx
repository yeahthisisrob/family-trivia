import { type ThreadsToday, threadChoicesFor } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { ThreadCard, ThreadCardView } from './ThreadCard';

const friends: ThreadsToday = {
  question: {
    about: { id: 'bob', name: 'Bob' },
    prompt: 'How do you know Bob?',
    choices: threadChoicesFor('friends'),
  },
  progress: { tied: 4, pairs: 10 },
};

const meta: Meta<typeof ThreadCardView> = {
  title: 'Home/ThreadCard',
  component: ThreadCardView,
  args: { today: friends, tied: null, onAnswer: async () => undefined },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof ThreadCardView>;

/** A friends circle: how you met, one tap. */
export const HowDoYouKnow: Story = {};

/** A family circle asks how you're related. */
export const HowAreYouRelated: Story = {
  args: {
    today: {
      question: {
        about: { id: 'carol', name: 'Carol' },
        prompt: 'How are you and Carol related?',
        choices: threadChoicesFor('family'),
      },
      progress: { tied: 9, pairs: 15 },
    },
  },
};

/** After the tap: the thread is tied and the web fills in a little. */
export const Tied: Story = {
  args: {
    today: { question: null, progress: { tied: 5, pairs: 10 } },
    tied: { name: 'Bob', label: 'In college', progress: { tied: 5, pairs: 10 } },
  },
};

/** The whole loop against the API: tap, give a year, tied. */
export const AnswerIt: StoryObj<typeof ThreadCard> = {
  render: () => <ThreadCard />,
  parameters: {
    msw: {
      handlers: [
        http.get('*/threads/today', () => HttpResponse.json({ ok: true, data: friends })),
        http.post('*/threads/answer', () =>
          HttpResponse.json({ ok: true, data: { tied: true, progress: { tied: 5, pairs: 10 } } }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('In college'));
    await userEvent.type(canvas.getByLabelText('Year'), '2004');
    await userEvent.click(canvas.getByText('Tie it'));
    await expect(await canvas.findByText('Thread tied with Bob')).toBeInTheDocument();
    await expect(canvas.getByText('5 of 10 threads tied')).toBeInTheDocument();
  },
};
