import { expect, test } from 'vitest';
import { applyTap } from './store';

test('a tap adds, swaps, or takes back the viewer’s reaction', () => {
  const start = { by: [{ userId: 'bob', reaction: 'love' as const }], mine: null };
  const added = applyTap(start, 'carol', 'laugh');
  expect(added.mine).toBe('laugh');
  expect(added.by.map((b) => b.userId)).toEqual(['carol', 'bob']);

  const swapped = applyTap(added, 'carol', 'hug');
  expect(swapped.by).toEqual([
    { userId: 'carol', reaction: 'hug' },
    { userId: 'bob', reaction: 'love' },
  ]);

  const back = applyTap(swapped, 'carol', 'hug');
  expect(back).toEqual(start);
});
