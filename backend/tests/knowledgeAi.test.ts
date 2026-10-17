const ai = vi.hoisted(() => ({ reply: '', prompt: '' }));
vi.mock('../services/bedrock/core/bedrockClient', () => ({
  invokeBedrockPrompt: async (prompt: string) => {
    ai.prompt = prompt;
    return {};
  },
}));
vi.mock('../services/bedrock/core/responseParser', () => ({
  collectResponseBody: async () => Buffer.from(''),
}));
vi.mock('../services/bedrock/core/textExtractor', () => ({ extractTextContent: () => ai.reply }));

import { readAnswers } from '../features/knowledge/ai';

const said = [
  {
    at: '2024-01-01T00:00:00.000Z',
    question: 'Comfort food?',
    answer: 'Mom’s pie, and Aunt Ivy’s soup',
  },
];
const family = [
  { id: 'grace', name: 'Grandma Grace', relation: 'parent' },
  { id: 'ivy', name: 'Aunt Ivy', relation: 'aunt or uncle' },
];

test('who a mention means, from the person answering; only someone in their family', async () => {
  ai.reply = JSON.stringify({
    items: [
      { kind: 'person', name: 'mom', says: 'Mom’s pie', answer: 0, about: 'grace' },
      { kind: 'person', name: 'aunt ivy', says: 'Aunt Ivy’s soup', answer: 0, about: 'ivy' },
      { kind: 'person', name: 'a stranger', says: 'pie', answer: 0, about: 'nobody' },
      { kind: 'food', name: 'pie', says: 'pie', answer: 0, about: 'grace' },
    ],
  });
  const items = await readAnswers('Bob', said, family);
  expect(items.map((i) => i.about)).toEqual(['grace', 'ivy', undefined, undefined]);
  // The prompt tells the reader who's who, from Bob's side.
  expect(ai.prompt).toContain('Grandma Grace (their parent, id grace)');
});
