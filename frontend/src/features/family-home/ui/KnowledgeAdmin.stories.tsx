import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { familyHomeHandlers } from './familyHomeMocks';
import { KnowledgeAdmin } from './KnowledgeAdmin';

const meta: Meta<typeof KnowledgeAdmin> = {
  title: 'Admin/KnowledgeAdmin',
  component: KnowledgeAdmin,
  parameters: { layout: 'padded', msw: { handlers: familyHomeHandlers() } },
};
export default meta;
type Story = StoryObj<typeof KnowledgeAdmin>;

export const ReadsUntilDone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Read 37 new answers' }));
    await expect(await canvas.findByRole('button', { name: 'Up to date' })).toBeInTheDocument();
  },
};
