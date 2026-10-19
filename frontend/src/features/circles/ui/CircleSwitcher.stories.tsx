import type { MyCircle } from '@family-trivia/shared';
import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { CircleSwitcher } from './CircleSwitcher';

const circles: MyCircle[] = [
  { id: 'home', name: 'The Smiths', kind: 'family', userId: 'alice' },
  { id: 'crew', name: 'The Crew', kind: 'friends', userId: 'al' },
  { id: 'all', name: 'Our People', kind: 'mixed', userId: 'alice' },
];

const mine = (list: MyCircle[]) =>
  http.get('*/me/circles', () =>
    HttpResponse.json({ ok: true, data: { current: 'home', circles: list } }),
  );

const meta: Meta<typeof CircleSwitcher> = {
  title: 'Features/Circles/CircleSwitcher',
  component: CircleSwitcher,
  args: { fallbackTitle: 'Family Trivia', color: '#fff', mutedColor: 'rgba(255,255,255,0.7)' },
  decorators: [
    (Story) => (
      <Box sx={{ bgcolor: 'primary.main', p: 2, display: 'flex' }}>
        <Story />
      </Box>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CircleSwitcher>;

/** In one circle: just its name, nothing new to learn. */
export const OneCircle: Story = {
  parameters: { msw: { handlers: [mine(circles.slice(0, 1))] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(await c.findByText('The Smiths')).toBeInTheDocument();
  },
};

/** In several: the name opens a menu of every circle, family and friends. */
export const SeveralCircles: Story = {
  parameters: { msw: { handlers: [mine(circles)] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: /The Smiths/ }));
    const menu = within(document.body);
    await expect(await menu.findByText('The Crew')).toBeInTheDocument();
    await expect(menu.getByText('Family and friends')).toBeInTheDocument();
    await expect(menu.getByText('Join another circle')).toBeInTheDocument();
  },
};

/** A passphrase that doesn't match says so, in plain words. */
export const JoinWithWrongPassphrase: Story = {
  parameters: {
    msw: {
      handlers: [
        mine(circles.slice(0, 1)),
        http.post('*/me/circles', () =>
          HttpResponse.json(
            { ok: false, error: 'Invalid passphrase', errorType: 'INVALID_PASSPHRASE' },
            { status: 422 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: /The Smiths/ }));
    const body = within(document.body);
    await userEvent.click(await body.findByText('Join another circle'));
    await userEvent.type(await body.findByLabelText('Passphrase'), 'wrong-words');
    await userEvent.click(body.getByRole('button', { name: 'Join' }));
    await expect(await body.findByText(/didn't match/)).toBeInTheDocument();
  },
};
