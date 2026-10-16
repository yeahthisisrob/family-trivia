/** MSW handlers for the Family home stories: the made-up example family. */
import type { FamilyKnowledge } from '@family-trivia/shared';
import { HttpResponse, http } from 'msw';
import { exampleFamily, exampleGraph } from '../../../test/fixtures/exampleFamily';

const ok = (data: unknown) => HttpResponse.json({ ok: true, data });

export const KNOWLEDGE: FamilyKnowledge = {
  themes: [
    {
      name: 'the beach',
      kind: 'place',
      people: ['carol', 'jo', 'alice', 'frank'],
      quotes: [{ personId: 'jo', says: 'beach with cousins' }],
    },
    {
      name: 'apple pie',
      kind: 'food',
      people: ['bob', 'ivy', 'grace'],
      quotes: [{ personId: 'grace', says: 'the one from my mother’s recipe' }],
    },
    {
      name: 'gardening',
      kind: 'activity',
      people: ['grace', 'carol'],
      quotes: [{ personId: 'carol', says: 'birds in the garden' }],
    },
  ],
  people: {
    jo: {
      top: [
        { name: 'the beach', kind: 'place', count: 4 },
        { name: 'soccer', kind: 'activity', count: 3 },
        { name: 'tacos', kind: 'food', count: 2 },
      ],
      persona: {
        text: 'Jo is happiest near water and loudest at a soccer game. Cousins come up in nearly every answer.',
        traits: ['loves the outdoors', 'competitive', 'close to cousins'],
        at: '2026-10-01T12:00:00Z',
        items: 12,
      },
      stats: { answers: 42, words: 610, bestStreak: 9, first: '2025-06-01' },
    },
  },
  stats: {
    answers: 1284,
    words: 21480,
    people: 11,
    busiestDay: 'Sunday',
    longestAnswer: { personId: 'grace', question: 'Tell us about your first home.', words: 212 },
  },
  unread: 37,
  builtAt: '2026-10-10T12:00:00Z',
};

export const STORY = `The Example Family spans two homes and four generations, held together by Sunday calls and a long running argument about apple pie.

Carol and Grandma Grace both answered that the birds at the feeder make them smile, years apart.`;

export const familyHomeHandlers = (story: string | null = STORY) => [
  http.get('*/family', () => ok({ family: exampleFamily, photoUrls: {} })),
  http.get('*/graph', () => ok(exampleGraph)),
  http.get('*/family/knowledge', () => ok(KNOWLEDGE)),
  http.post('*/admin/knowledge/build', () => ok({ read: 37, personas: 3, left: 0, failures: [] })),
  http.get('*/family/story', () =>
    ok({
      markdown: story,
      generatedAt: story ? '2026-10-01T12:00:00Z' : null,
      stats: { people: 11, playing: 8, households: 2, answers: 1284, since: '2025-06-01' },
    }),
  ),
  http.get('*/member-summary', ({ request }) => {
    const url = new URL(request.url);
    const roast = url.searchParams.get('mode') === 'roast';
    return ok({
      userId: url.searchParams.get('userId'),
      mode: roast ? 'roast' : 'regular',
      lastUpdated: '2026-10-01T12:00:00Z',
      summary: roast
        ? 'Claims to love early mornings. Has never once been seen before nine.'
        : 'Happiest outside, quick with a joke, and the first to call when someone has news.',
      insights: [
        { text: 'Loves the beach', category: 'preference' },
        { text: 'Early riser (says so)', category: 'personality' },
      ],
    });
  }),
  http.get('*/family/words', ({ request }) =>
    ok({
      personId: new URL(request.url).searchParams.get('personId'),
      words: [
        {
          question: 'What always makes you smile?',
          answer: 'The birds at the feeder',
          date: '2025-09-14',
        },
        { question: 'What app would you miss most?', answer: 'This one', date: '2025-08-02' },
      ],
    }),
  ),
];
