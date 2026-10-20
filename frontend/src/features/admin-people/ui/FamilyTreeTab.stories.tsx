import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { FamilyTreeTab } from './FamilyTreeTab';
import { peopleHandlers } from './peopleMocks';

const meta: Meta<typeof FamilyTreeTab> = {
  title: 'Admin/FamilyTreeTab',
  component: FamilyTreeTab,
  parameters: { layout: 'padded', msw: { handlers: peopleHandlers() } },
};
export default meta;
type Story = StoryObj<typeof FamilyTreeTab>;

export const Empty: Story = {
  parameters: { msw: { handlers: peopleHandlers({ empty: true }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Family Sides')).toBeInTheDocument();
  },
};

/** Two root partners and a side for each half of the family. */
export const WithSides: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('Springfield')).toBeInTheDocument();
    await expect(canvas.getByDisplayValue('grandmother')).toBeInTheDocument();
  },
};
