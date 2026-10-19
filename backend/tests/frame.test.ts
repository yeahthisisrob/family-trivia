vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { framePrompt } from '../services/bedrock/core/frame';
import { inCircle } from '../services/scope';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

beforeEach(() => {
  resetS3Mock();
  seedRaw('circles.json', {
    version: 1,
    circles: [
      { id: 'home', name: 'The Smiths', kind: 'family', root: true },
      { id: 'crew', name: 'The Crew', kind: 'friends' },
    ],
  });
});

describe('the AI frame', () => {
  test('a family prompt goes out as written', async () => {
    const out = await inCircle({ circleId: 'home', root: true }, () =>
      framePrompt('Write a question for the family.'),
    );
    expect(out).toBe('Write a question for the family.');
  });

  test('in a friends circle every prompt says who these people are', async () => {
    const out = await inCircle({ circleId: 'crew', root: false }, () =>
      framePrompt('Write a question for the family.'),
    );
    expect(out.startsWith('WHO THIS IS FOR: a circle of close friends.')).toBe(true);
    expect(out).toContain('read "the friends"');
    expect(out).toContain('no family framing');
    expect(out.endsWith('Write a question for the family.')).toBe(true);
  });
});
