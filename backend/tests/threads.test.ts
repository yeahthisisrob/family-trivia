vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { relationOf } from '@family-trivia/shared';
import { answerThread, threadsToday } from '../features/threads/service';
import { createCircle, scopeOf } from '../services/circles';
import { addMember } from '../services/family/members';
import { loadFamily } from '../services/family/roster';
import { inCircle } from '../services/scope';
import { listStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

beforeEach(() => resetS3Mock());

/** A new friends circle: alice made it, bob and carol joined. */
async function crewOfThree() {
  seedRaw('config/users.json', { users: { alice: { group: '', color: '#000', isAdmin: true } } });
  seedRaw('config/google-auth-map.json', { 'alice@example.com': 'alice' });
  const crew = await createCircle(
    { name: 'The Crew', kind: 'friends' },
    { email: 'alice@example.com', name: 'Alice' },
  );
  const scope = scopeOf(crew);
  await inCircle(scope, async () => {
    await addMember({ id: 'bob', name: 'Bob', color: '#111' });
    await addMember({ id: 'carol', name: 'Carol', color: '#222' });
  });
  return scope;
}

describe('threads', () => {
  test('asks how you know someone, ties the thread, then waits for tomorrow', async () => {
    const scope = await crewOfThree();
    await inCircle(scope, async () => {
      const today = await threadsToday('alice');
      expect(today.progress).toEqual({ tied: 0, pairs: 3 });
      expect(today.question?.prompt).toMatch(/^How do you know (Bob|Carol)\?$/);
      expect(today.question?.choices[0]?.id).toBe('met:school');

      const about = today.question?.about.id as string;
      const result = await answerThread('alice', { about, choice: 'met:college', when: '2004' });
      expect(result).toEqual({ ok: true, tied: true, progress: { tied: 1, pairs: 3 } });

      const family = await loadFamily();
      expect(relationOf(family, 'alice', about)).toBe('friend');
      expect(family.ties[0]).toMatchObject({
        type: 'friend',
        met: { how: 'college', when: '2004' },
      });
      // The save kept what it replaced, the way every family save does.
      expect(listStored('circles/the-crew/family/history/')).toHaveLength(1);

      // One a day.
      expect((await threadsToday('alice')).question).toBeNull();
    });
  });

  test('everyone answers about everyone; a thread already tied is never asked again', async () => {
    const scope = await crewOfThree();
    await inCircle(scope, async () => {
      await answerThread('alice', { about: 'bob', choice: 'met:work' });
      const bob = await threadsToday('bob');
      expect(bob.question?.about.id).toBe('carol');
      expect((await answerThread('bob', { about: 'carol', choice: NOT_MET_ID })).ok).toBe(true);
      expect((await loadFamily()).ties).toHaveLength(1);
      // Carol hasn't answered anyone, and nobody has tied a thread to her.
      expect(['alice', 'bob']).toContain((await threadsToday('carol')).question?.about.id);
    });
  });

  test('a family circle asks how you are related, and the tie points the right way', async () => {
    seedRaw('family/family.json', {
      version: 2,
      name: 'The Smiths',
      people: {
        alice: { id: 'alice', name: 'Alice', participation: 'playing' },
        carol: { id: 'carol', name: 'Carol', participation: 'playing' },
      },
      ties: [],
      households: {},
    });
    const today = await threadsToday('carol');
    expect(today.question?.prompt).toBe('How are you and Alice related?');
    await answerThread('carol', { about: 'alice', choice: 'parent' });
    expect(relationOf(await loadFamily(), 'carol', 'alice')).toBe('parent');
  });

  test('answers about strangers or made-up choices are refused', async () => {
    const scope = await crewOfThree();
    await inCircle(scope, async () => {
      expect(await answerThread('alice', { about: 'zed', choice: 'met:work' })).toMatchObject({
        ok: false,
      });
      expect(await answerThread('alice', { about: 'bob', choice: 'parent!' })).toMatchObject({
        ok: false,
      });
    });
  });
});

const NOT_MET_ID = 'not-met';
