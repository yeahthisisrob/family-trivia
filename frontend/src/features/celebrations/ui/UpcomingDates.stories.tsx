import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import UpcomingDates from './UpcomingDates';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return { month: d.getMonth() + 1, day: d.getDate() };
};

const birthday = (name: string, offset: number, extra: Record<string, unknown> = {}) => {
  const { month, day: dd } = day(offset);
  return {
    userId: name.toLowerCase(),
    name,
    birthday: `${month}/${dd}`,
    month,
    day: dd,
    daysUntil: offset,
    isToday: offset === 0,
    isPast: false,
    type: 'birthday',
    isFromFacts: true,
    ...extra,
  };
};

const respond = (birthdays: unknown[], todaysBirthdays: unknown[]) =>
  http.get('*/upcoming-birthdays', () =>
    HttpResponse.json({ ok: true, data: { birthdays, todaysBirthdays, hasMore: false } }),
  );

const meta: Meta<typeof UpcomingDates> = {
  title: 'UpcomingDates/UpcomingDates',
  component: UpcomingDates,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <StoryProviders>
        <div style={{ maxWidth: 520 }}>
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof UpcomingDates>;

export const Upcoming: Story = {
  parameters: {
    msw: {
      handlers: [respond([birthday('Alice', 3), birthday('Bob', 12), birthday('Carol', 40)], [])],
    },
  },
};

/** Someone the family remembers: a quiet "Remembering" card with a candle, no party. */
export const RememberingToday: Story = {
  parameters: {
    msw: {
      handlers: [respond([birthday('Bob', 5)], [birthday('Grace', 0, { remembered: true })])],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The card loads after a short deferral (below the fold).
    await expect(await canvas.findByText('Remembering', {}, { timeout: 5000 })).toBeInTheDocument();
  },
};
