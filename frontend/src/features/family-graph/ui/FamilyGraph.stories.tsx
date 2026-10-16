import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { exampleGraph as data } from '../../../test/fixtures/exampleFamily';
import { FamilyGraph } from './FamilyGraph';

const meta: Meta<typeof FamilyGraph> = {
  title: 'Family/FamilyGraph',
  component: FamilyGraph,
  args: { data, meId: 'carol', height: 520 },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof FamilyGraph>;

export const BlendedFamily: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect((await canvas.findAllByText('Answered alike')).length).toBeGreaterThan(0);
    await expect(canvas.getByRole('combobox')).toBeInTheDocument();
  },
};

export const WithHouseholds: Story = {
  args: { initialOptions: { households: true, minAlike: 1 } },
};
