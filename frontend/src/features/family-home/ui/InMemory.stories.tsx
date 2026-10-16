import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { exampleFamily } from '../../../test/fixtures/exampleFamily';
import { InMemory } from './InMemory';

const meta: Meta<typeof InMemory> = {
  title: 'Family/InMemory',
  component: InMemory,
  args: {
    people: Object.values(exampleFamily.people).filter((p) => p.memorial),
    photos: {},
    onOpen: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof InMemory>;

export const OnePerson: Story = {};
