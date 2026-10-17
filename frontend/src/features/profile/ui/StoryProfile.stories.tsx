import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { rememberingHandlers } from '../../remembering/ui/rememberingMocks';
import { profileHandlers } from './profileMocks';
import { StoryProfile } from './StoryProfile';

const meta: Meta<typeof StoryProfile> = {
  title: 'Profile/StoryProfile',
  component: StoryProfile,
  args: { userId: 'jo', meId: 'carol', onBack: fn() },
  parameters: { layout: 'padded', msw: { handlers: profileHandlers() } },
};
export default meta;
type Story = StoryObj<typeof StoryProfile>;

/** Someone else: who they are to you, what the index says, what they've said lately. */
export const SomeoneElse: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Jo' })).toBeInTheDocument();
    await expect(await canvas.findByText(/happiest near water/)).toBeInTheDocument();
    await expect(
      await canvas.findByRole('heading', { name: 'What Jo has said lately' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText('5 reactions, 2 comments')).toBeInTheDocument();
    await expect(await canvas.findByRole('heading', { name: 'You & Jo' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'What the family says about Jo' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText('64%')).toBeInTheDocument();
  },
};

/** Your own: filling in your story sits under who you are, editing at the end. */
export const You: Story = {
  args: { userId: 'carol' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Fill in your story')).toBeInTheDocument();
    await expect(
      await canvas.findByRole('heading', { name: 'What you’ve said lately' }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Edit your answers' })).toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: /^You & / })).toBeNull();
  },
};

/** Someone the family has lost: their Remembering page. */
export const Remembered: Story = {
  args: { userId: 'grace' },
  parameters: { msw: { handlers: [...rememberingHandlers(), ...profileHandlers()] } },
  play: async () => {
    const page = within(document.body);
    await expect(
      await page.findByRole('heading', { name: 'The last things Grandma Grace told us' }),
    ).toBeInTheDocument();
  },
};
