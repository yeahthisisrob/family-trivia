vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import {
  addMemory,
  createLink,
  decideMemory,
  previewLink,
  revokeLink,
  visitorMemories,
} from '../features/memory-links/service';
import { inCircle } from '../services/scope';
import { listStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

// A made-up friend the crew remembers (never a real one: docs/decisions/0006).
const crew = { circleId: 'crew', root: false };

beforeEach(() => {
  resetS3Mock();
  seedRaw('circles.json', {
    version: 1,
    circles: [
      { id: 'home', name: 'The Smiths', kind: 'family', root: true },
      { id: 'crew', name: 'The Crew', kind: 'friends' },
    ],
  });
  seedRaw('circles/crew/family/family.json', {
    version: 2,
    name: 'The Crew',
    people: {
      alice: { id: 'alice', name: 'Alice', participation: 'playing' },
      sam: {
        id: 'sam',
        name: 'Sam',
        participation: 'not-playing',
        born: { date: '1985' },
        memorial: { died: '2017', dedication: 'Always the first to laugh.' },
      },
    },
    ties: [],
    households: {},
  });
});

const makeLink = () =>
  inCircle(crew, () =>
    createLink({ circleId: 'crew', personId: 'sam', lifetime: 'month', createdBy: 'alice' }),
  );

describe('memory links', () => {
  test('anyone with the link adds a memory; it waits, then shows once let in', async () => {
    const link = await makeLink();
    expect(link?.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // The link itself lives outside any circle; the memories in the circle.
    expect(listStored('memory-links/')).toHaveLength(1);

    const before = await previewLink(link?.token as string);
    expect(before).toMatchObject({
      state: 'open',
      person: { name: 'Sam', years: '1985 to 2017', dedication: 'Always the first to laugh.' },
      circle: { name: 'The Crew', kind: 'friends' },
      memories: [],
    });

    expect(
      await addMemory(link?.token as string, {
        name: 'Dee',
        how: 'we played in a band',
        text: 'He tuned my guitar before every show.',
      }),
    ).toEqual({ ok: true });
    expect(listStored('circles/crew/remembering/sam/')).toHaveLength(1);
    expect((await previewLink(link?.token as string))?.memories).toEqual([]);

    const waiting = await inCircle(crew, () => visitorMemories('sam', true));
    expect(waiting).toHaveLength(1);
    expect(await inCircle(crew, () => visitorMemories('sam', false))).toEqual([]);
    await inCircle(crew, () => decideMemory('sam', waiting[0]?.id as string, true));
    expect((await previewLink(link?.token as string))?.memories).toEqual([
      expect.objectContaining({ name: 'Dee', text: 'He tuned my guitar before every show.' }),
    ]);
  });

  test('only for someone remembered; a link taken back closes', async () => {
    expect(
      await inCircle(crew, () =>
        createLink({ circleId: 'crew', personId: 'alice', lifetime: 'week', createdBy: 'alice' }),
      ),
    ).toBeNull();
    const link = await makeLink();
    expect(await revokeLink(link?.token as string, 'home')).toBe(false);
    expect(await revokeLink(link?.token as string, 'crew')).toBe(true);
    expect(await previewLink(link?.token as string)).toEqual({ state: 'revoked' });
    expect(await addMemory(link?.token as string, { name: 'Dee', text: 'x' })).toMatchObject({
      ok: false,
      status: 410,
    });
    expect(await previewLink('not-a-real-token')).toBeNull();
  });
});
