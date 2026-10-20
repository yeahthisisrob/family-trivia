import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { GroupsTab } from './GroupsTab';
import { peopleHandlers } from './peopleMocks';

const meta: Meta<typeof GroupsTab> = {
  title: 'Admin/GroupsTab',
  component: GroupsTab,
  parameters: { layout: 'padded', msw: { handlers: peopleHandlers() } },
};
export default meta;
type Story = StoryObj<typeof GroupsTab>;

export const Empty: Story = {
  parameters: { msw: { handlers: peopleHandlers({ empty: true }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Add Group' })).toBeInTheDocument();
  },
};

export const WithGroups: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Parents')).toBeInTheDocument();
    await expect(canvas.getByText('The grown-ups')).toBeInTheDocument();
    await expect(canvas.getByText('Shelbyville')).toBeInTheDocument();
  },
};
