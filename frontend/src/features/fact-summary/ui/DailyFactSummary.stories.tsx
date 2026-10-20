import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, HttpResponse, http } from 'msw';
import { expect, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import DailyFactSummary from './DailyFactSummary';

const week = {
  weekStartDate: '2026-10-11',
  weekEndDate: '2026-10-17',
  summary:
    'A week of road trips and kitchen stories: the coast came up twice, and so did pancakes.',
  lastUpdated: '2026-10-18T12:00:00.000Z',
  totalResponses: 9,
  sideAResponses: 5,
  sideBResponses: 4,
  factType: 'shared',
  totalQuestions: 1,
  uniqueParticipants: 9,
  participationRate: 75,
};

const meta: Meta<typeof DailyFactSummary> = {
  title: 'Home/DailyFactSummary',
  component: DailyFactSummary,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof DailyFactSummary>;

/** Last week's answers, summed up (asked a moment after Home opens). */
export const LastWeek: Story = {
  parameters: {
    msw: { handlers: [http.get('*/daily-fact-summary', () => HttpResponse.json(week))] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/road trips and kitchen stories/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  },
};

/** Still being written. */
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/daily-fact-summary', async () => {
          await delay('infinite');
          return HttpResponse.json(week);
        }),
      ],
    },
  },
};
