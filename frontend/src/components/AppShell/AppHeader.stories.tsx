import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryProviders } from '../../test/storyContexts';
import AppHeader from './AppHeader';

const meta: Meta<typeof AppHeader> = {
  title: 'AppShell/AppHeader',
  component: AppHeader,
  parameters: { layout: 'fullscreen' },
  args: {
    selectedUser: 'alice',
    currentPath: '/',
    onLogout: fn(),
    onNavigate: fn(),
    onAvatarClick: fn(),
    onNotificationClick: fn(),
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof AppHeader>;

export const Home: Story = {};
export const OnTrivia: Story = { args: { currentPath: '/play' } };
export const OnLeaderboard: Story = { args: { currentPath: '/leaderboard' } };
export const Admin: Story = { args: { isAdmin: true } };
export const Loading: Story = { args: { loading: true } };

/** In a family and two circles of friends: the title opens every circle. */
export const InSeveralCircles: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/me/circles', () =>
          HttpResponse.json({
            ok: true,
            data: {
              current: 'home',
              circles: [
                { id: 'home', name: 'The Smiths', kind: 'family', userId: 'alice' },
                { id: 'crew', name: 'The Springfield Crew', kind: 'friends', userId: 'al' },
                { id: 'all', name: 'Our People', kind: 'mixed', userId: 'alice' },
              ],
            },
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: /The Smiths/ }));
    await expect(
      await within(document.body).findByText('The Springfield Crew'),
    ).toBeInTheDocument();
  },
};
