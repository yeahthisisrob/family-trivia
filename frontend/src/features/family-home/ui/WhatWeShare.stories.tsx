import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { exampleFamily } from '../../../test/fixtures/exampleFamily';
import { KNOWLEDGE } from './familyHomeMocks';
import { WhatWeShare } from './WhatWeShare';

const nameOf = (id: string) => exampleFamily.people[id]?.name ?? id;

const meta: Meta<typeof WhatWeShare> = {
  title: 'Family/WhatWeShare',
  component: WhatWeShare,
  args: { themes: KNOWLEDGE.themes, nameOf, photos: {}, onOpen: fn() },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof WhatWeShare>;

export const Themes: Story = {};
