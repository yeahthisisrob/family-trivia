import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AppearanceMenu } from './AppearanceMenu';

const meta: Meta<typeof AppearanceMenu> = {
  title: 'Design System/AppearanceMenu',
  component: AppearanceMenu,
};
export default meta;
type Story = StoryObj<typeof AppearanceMenu>;

/** Pick a theme and the whole page follows. */
export const ChooseATheme: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Appearance' }));
    const body = within(canvasElement.ownerDocument.body);
    const garden = await body.findByRole('option', { name: /Garden/ });
    await userEvent.click(garden);
    await expect(garden).toHaveAttribute('aria-selected', 'true');
  },
};

/** Admins can make the current theme the family's default. */
export const ForAdmins: Story = {
  args: { onSetFamilyDefault: fn(async () => undefined) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Appearance' }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('button', { name: /family default/ })).toBeInTheDocument();
  },
};
