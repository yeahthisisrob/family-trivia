import { findJsonWithKey, withoutJsonKey } from '../services/bedrock/core/jsonInText';

const insights = { insights: [{ text: 'Loves the beach', category: 'preference' }] };

test.each([
  ['compact', `Summary text.\n${JSON.stringify(insights)}`],
  ['pretty', `Summary text.\n${JSON.stringify(insights, null, 2)}`],
  ['fenced', `Summary text.\n\`\`\`json\n${JSON.stringify(insights, null, 2)}\n\`\`\``],
  ['braces in strings', `x {"insights": [{"text": "Says } and { a lot", "category": "fact"}]} y`],
])('finds %s JSON', (_label, text) => {
  expect(findJsonWithKey<typeof insights>(text, 'insights')?.value.insights.length).toBe(1);
});

test('strips the JSON (and its fence) from the prose', () => {
  expect(
    withoutJsonKey(`Summary text.\n\`\`\`json\n${JSON.stringify(insights)}\n\`\`\``, 'insights'),
  ).toBe('Summary text.');
});

test('no JSON is null', () => {
  expect(findJsonWithKey('just words', 'insights')).toBeNull();
});
