vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
const ai = vi.hoisted(() => ({ reply: [] as unknown[] }));
vi.mock('../features/plans/ai', () => ({
  readDrops: async () => ai.reply,
  latestStart: (today: string) => `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`,
}));

import { addDays, getTodayET } from '@family-trivia/shared';
import {
  afterPlans,
  answerPlan,
  dropIn,
  rememberPlan,
  removeDrop,
  viewPlans,
} from '../features/plans/service';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const today = getTodayET();
const day = (n: number) => addDays(today, n);

beforeEach(() => {
  resetS3Mock();
  seedRaw('family/family.json', {
    version: 2,
    name: 'The Crew',
    people: {
      alice: { id: 'alice', name: 'Alice', participation: 'playing' },
      bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    },
    ties: [],
    households: {},
  });
});

describe('plans', () => {
  test('drop in, see it in the weeks ahead, take it back', async () => {
    ai.reply = [{ kind: 'busy', title: 'Dentist', start: day(2) }];
    const [added] = await dropIn('alice', 'dentist on thursday');
    expect(added).toMatchObject({ by: 'alice', kind: 'busy', said: 'dentist on thursday' });

    const bobSees = await viewPlans('bob');
    expect(bobSees.days.find((d) => d.date === day(2))?.busy).toEqual(['alice']);
    expect(bobSees.drops[0]?.title).toBe('Busy');
    expect((await viewPlans('alice')).drops[0]?.title).toBe('Dentist');

    expect(await removeDrop('bob', added?.id as string)).toBe(false);
    expect(await removeDrop('alice', added?.id as string)).toBe(true);
    expect((await viewPlans('alice')).drops).toEqual([]);
  });

  test("a plan is something to say you're in for; busy time isn't", async () => {
    ai.reply = [
      { kind: 'plan', title: 'Hike at the falls', start: day(5) },
      { kind: 'busy', title: 'Work trip', start: day(6) },
    ];
    const [hike, trip] = await dropIn('bob', 'hike saturday, who is in? away sunday');
    expect(await answerPlan('alice', hike?.id as string, 'in')).toBe(true);
    expect(await answerPlan('alice', trip?.id as string, 'in')).toBe(false);
    expect((await viewPlans('bob')).rsvps[hike?.id as string]).toEqual({ alice: 'in' });
  });

  test("nothing in the past, nothing the AI made up that isn't a day", async () => {
    ai.reply = [
      { kind: 'busy', title: 'Yesterday', start: day(-1) },
      { kind: 'busy', title: 'Someday', start: 'soon' },
    ];
    expect(await dropIn('alice', 'yesterday and someday')).toEqual([]);
  });
});

describe('after the day', () => {
  test('the people who were in are asked how it went; memories are shared; skip stops asking', async () => {
    seedRaw('plans/people/bob.json', {
      drops: [
        { id: 'bob-hike', by: 'bob', kind: 'plan', title: 'Hike', start: day(-2), createdAt: 'x' },
      ],
    });
    seedRaw('plans/rsvp/bob-hike.json', { alice: 'in' });
    seedRaw('family/family.json', {
      version: 2,
      name: 'The Crew',
      people: Object.fromEntries(
        ['alice', 'bob', 'carol'].map((id) => [id, { id, name: id, participation: 'playing' }]),
      ),
      ties: [],
      households: {},
    });
    expect((await afterPlans('alice')).map((p) => p.drop.title)).toEqual(['Hike']);
    expect(await afterPlans('carol')).toEqual([]);
    expect(await rememberPlan('carol', 'bob-hike', { text: 'x' })).toBe(false);

    expect(await rememberPlan('alice', 'bob-hike', { text: 'The view at the top.' })).toBe(true);
    expect((await afterPlans('bob'))[0]?.memories).toMatchObject([
      { by: 'alice', text: 'The view at the top.' },
    ]);
    expect(await rememberPlan('bob', 'bob-hike', 'skip')).toBe(true);
    expect(await afterPlans('bob')).toEqual([]);
  });

  test('a plan still to come, or long past, asks nothing', async () => {
    seedRaw('plans/people/bob.json', {
      drops: [
        { id: 'bob-soon', by: 'bob', kind: 'plan', title: 'Soon', start: day(3), createdAt: 'x' },
        { id: 'bob-old', by: 'bob', kind: 'plan', title: 'Old', start: day(-40), createdAt: 'x' },
      ],
    });
    expect(await afterPlans('bob')).toEqual([]);
  });
});
