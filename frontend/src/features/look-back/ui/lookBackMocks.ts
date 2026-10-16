/** MSW handlers for the look-back stories: a made-up season of the example family. */
import type { BookPage, SeasonReview } from '@family-trivia/shared';
import { HttpResponse, http } from 'msw';
import { familyHomeHandlers } from '../../family-home/ui/familyHomeMocks';

const page = (date: string, question: string, answers: [string, string][]): BookPage => ({
  date,
  question,
  answers: answers.map(([personId, answer]) => ({ personId, answer })),
});

const BOOK: BookPage[] = [
  page('2025-06-02', 'Happy place?', [
    ['carol', 'The beach'],
    ['jo', 'Beach with cousins'],
    ['bob', 'The garden at sunrise'],
    ['ivy', 'My kitchen on a Sunday'],
  ]),
  page('2025-06-03', 'Comfort food?', [
    ['bob', 'Mom’s apple pie'],
    ['ivy', 'Apple pie'],
    ['alice', 'Grilled cheese and tomato soup'],
  ]),
  page('2025-07-01', 'A song you know every word to?', [
    ['carol', 'Moon River'],
    ['frank', 'The theme from our old cartoon'],
  ]),
];

export const SUMMER: SeasonReview = {
  season: { number: 2, name: 'Summer', startDate: '2025-06-01', endDate: '2025-07-31' },
  seasons: [
    { number: 2, name: 'Summer' },
    { number: 1, name: 'Spring' },
  ],
  numbers: { people: 6, answers: 9, words: 41, trivia: 120, comments: 7, reactions: 12, days: 3 },
  together: BOOK.slice(0, 2),
  loved: [
    {
      id: 'bob_2025-06-03T13:00:00.000Z',
      personId: 'bob',
      question: 'Comfort food?',
      answer: 'Mom’s apple pie',
      reactions: 6,
      comments: 3,
    },
  ],
  people: [
    { personId: 'carol', answers: 2, words: 4, trivia: 40, right: 30, points: 52 },
    { personId: 'bob', answers: 2, words: 8, trivia: 38, right: 20, points: 31 },
    { personId: 'jo', answers: 1, words: 3, trivia: 0, right: 0, points: 0 },
  ],
  book: BOOK,
};

export const lookBackHandlers = (review: SeasonReview | null = SUMMER) => [
  ...familyHomeHandlers(),
  http.get('*/seasons/review', () =>
    review
      ? HttpResponse.json({ ok: true, data: review })
      : HttpResponse.json({ ok: false, error: 'No seasons yet' }, { status: 404 }),
  ),
];
