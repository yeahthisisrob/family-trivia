import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { familyHomeHandlers, STORY } from './familyHomeMocks';
import { StoryAdmin } from './StoryAdmin';

const meta: Meta<typeof StoryAdmin> = {
  title: 'Admin/StoryAdmin',
  component: StoryAdmin,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.post('*/admin/family/story', () =>
          HttpResponse.json({
            ok: true,
            data: {
              markdown: STORY,
              generatedAt: '2026-10-16T12:00:00Z',
              stats: { people: 11, playing: 8, households: 2, answers: 1284, since: '2025-06-01' },
            },
          }),
        ),
        ...familyHomeHandlers(),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof StoryAdmin>;

export const Written: Story = {};
export const NotYetWritten: Story = {
  parameters: { msw: { handlers: familyHomeHandlers(null) } },
};
