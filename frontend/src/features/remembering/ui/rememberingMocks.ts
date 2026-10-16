/** MSW handlers for the Remembering stories: made-up words from the example family's grandmother. */
import type { Comment, Remembering } from '@family-trivia/shared';
import { HttpResponse, http } from 'msw';

const ok = (data: unknown, status = 200) => HttpResponse.json({ ok: true, data }, { status });

const w = (date: string, question: string, answer: string) => ({
  id: `grace_${date}T13:00:00.000Z`,
  question,
  answer,
  date,
});

export const GRACE: Remembering = {
  personId: 'grace',
  words: [
    w('2023-05-02', 'Who taught you to cook?', 'My mother, standing on a chair at her stove'),
    w('2023-05-09', 'Favorite season?', 'Fall, for the apples'),
    w('2023-06-11', 'What always makes you smile?', 'Birds in the garden'),
    w('2023-06-20', 'Best trip you ever took?', 'The lake house the summer the kids were small'),
    w('2023-11-03', 'A song you know every word to?', 'Moon River'),
    w('2024-01-14', 'What would you tell your younger self?', 'Call your sister more'),
    w('2024-02-10', 'Which possession would you keep forever?', 'My recipe box'),
  ],
  last: [
    'grace_2024-02-10T13:00:00.000Z',
    'grace_2024-01-14T13:00:00.000Z',
    'grace_2023-11-03T13:00:00.000Z',
    'grace_2023-06-20T13:00:00.000Z',
    'grace_2023-06-11T13:00:00.000Z',
  ],
  loved: [
    { id: 'grace_2024-01-14T13:00:00.000Z', reactions: 6, comments: 3 },
    { id: 'grace_2023-05-02T13:00:00.000Z', reactions: 4, comments: 0 },
  ],
  trivia: { played: 88, right: 51 },
  span: { first: '2023-05-02', last: '2024-02-18' },
};

export const MEMORIES: Comment[] = [
  {
    id: 'm1',
    userId: 'carol',
    text: 'Every Sunday she had a pie cooling by the window, and she always let me have the first slice.',
    timestamp: '2024-03-10T18:00:00.000Z',
  },
  {
    id: 'm2',
    userId: 'bob',
    text: 'She hummed Moon River while she did the dishes. I still hear it.',
    timestamp: '2024-03-12T09:30:00.000Z',
  },
];

export const rememberingHandlers = (data: Remembering = GRACE, memories = MEMORIES) => {
  const thread = [...memories];
  return [
    http.get('*/family/remembering', () => ok(data)),
    http.get('*/comments', () =>
      ok({
        thread: {
          contentType: 'memorial',
          contentId: data.personId,
          comments: thread,
          lastUpdated: '',
        },
      }),
    ),
    http.post('*/comments', async ({ request }) => {
      const body = (await request.json()) as { text: string };
      const comment = {
        id: `m${thread.length + 1}`,
        userId: 'carol',
        text: body.text,
        timestamp: '2024-04-01T12:00:00.000Z',
      };
      thread.push(comment);
      return ok({ comment, success: true }, 201);
    }),
  ];
};
