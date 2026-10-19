/** MSW handlers for the profile stories: made-up answers from the example family's cousin Jo. */
import type { PersonStory } from '@family-trivia/shared';
import { HttpResponse, http } from 'msw';
import { familyHomeHandlers } from '../../family-home/ui/familyHomeMocks';

const ok = (data: unknown) => HttpResponse.json({ ok: true, data });

const w = (date: string, question: string, answer: string) => ({
  id: `jo_${date}T15:00:00.000Z`,
  question,
  answer,
  date,
});

export const JO: PersonStory = {
  personId: 'jo',
  words: [
    w('2025-06-02', 'Happy place?', 'Beach with cousins'),
    w('2025-06-09', 'Best game ever played?', 'The rainout soccer final, we won 1-0 in the mud'),
    w('2025-07-14', 'Comfort food?', 'Tacos, every time'),
    w('2025-07-30', 'A trip you’d take again?', 'The lake, the summer we all fit in one cabin'),
    w('2026-03-28', 'What’s on your nightstand?', 'A book I keep meaning to finish'),
    w('2026-04-04', 'Small thing that makes your day?', 'A text from Grandma with too many emojis'),
  ],
  last: [
    'jo_2026-04-04T15:00:00.000Z',
    'jo_2026-03-28T15:00:00.000Z',
    'jo_2025-07-30T15:00:00.000Z',
    'jo_2025-07-14T15:00:00.000Z',
    'jo_2025-06-09T15:00:00.000Z',
  ],
  loved: [{ id: 'jo_2026-04-04T15:00:00.000Z', reactions: 5, comments: 2 }],
  trivia: { played: 64, right: 41 },
  span: { first: '2025-06-02', last: '2026-04-04' },
  mentions: [
    {
      id: 'carol_2026-03-01T15:00:00.000Z',
      personId: 'carol',
      question: 'Who always makes you laugh?',
      answer: 'Jo, every single holiday',
      date: '2026-03-01',
    },
  ],
  replies: [],
  loves: [
    {
      kind: 'place',
      name: 'the beach',
      count: 4,
      says: ['Beach with cousins'],
      note: 'Sand is mostly tiny bits of rock and shell, worn down over thousands of years.',
    },
    {
      kind: 'food',
      name: 'tacos',
      count: 2,
      says: ['Tacos, every time'],
      note: 'Corn tortillas have been made in Mexico for thousands of years.',
    },
    {
      kind: 'media',
      name: 'the beatles',
      count: 2,
      says: ['Abbey Road on repeat'],
      tag: 'band',
      note: 'The Beatles recorded most of their albums at Abbey Road Studios in London.',
    },
  ],
};

export const profileHandlers = (story: PersonStory = JO) => [
  ...familyHomeHandlers(),
  http.get('*/family/person-story', () => ok(story)),
  http.get('*/fill-in', () =>
    ok({
      items: [],
      suggested: [],
      summary: { answered: 41, total: 58, yourWords: 6, familyWords: 13, depth: 'shorter' },
    }),
  ),
];
