import React from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import DifficultySelect from './DifficultySelect';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DifficultySelect> = {
  title: 'Trivia/Selection/DifficultySelect',
  component: DifficultySelect,
  parameters: { layout: 'padded' },
  args: {
    onSelect: fn(),
    onBack: fn(),
  },
  decorators: [
    (Story) => <div style={{ maxWidth: 400 }}><Story /></div>,
  ],
};
export default meta;
type Story = StoryObj<typeof DifficultySelect>;

export const Default: Story = {
  args: { category: 'History & Politics' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('History & Politics')).toBeInTheDocument();
    await expect(canvas.getByText('Casual')).toBeInTheDocument();
    await expect(canvas.getByText('Classic')).toBeInTheDocument();
    await expect(canvas.getByText('Expert')).toBeInTheDocument();
    // Multiplier badges
    await expect(canvas.getByText('½×')).toBeInTheDocument();
    await expect(canvas.getByText('1×')).toBeInTheDocument();
    await expect(canvas.getByText('2×')).toBeInTheDocument();
  },
};

export const ClickDifficultyCallsOnSelect: Story = {
  args: { category: 'Science & Nature' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const hardTile = canvas.getByText('Expert').closest('div')!.parentElement!;
    await userEvent.click(hardTile);
    await expect(args.onSelect).toHaveBeenCalledWith('hard');
  },
};

export const ClickBackCallsOnBack: Story = {
  args: { category: 'Pop Culture' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The back arrow button
    const buttons = canvas.getAllByRole('button');
    await userEvent.click(buttons[0]);
    await expect(args.onBack).toHaveBeenCalled();
  },
};

export const CustomCategoryName: Story = {
  args: { category: 'My Custom Category About Space Exploration' },
};

export const LongCategoryName: Story = {
  args: { category: 'Historical Events, Politics, and World Leaders' },
  parameters: {
    docs: { description: { story: 'Long category name wraps cleanly in the header.' } },
  },
};

export const LocalCategory: Story = {
  args: { category: 'Rochester, NY' },
};
