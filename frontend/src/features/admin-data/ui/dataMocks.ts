/** What Admin › Player Data reads, as MSW answers for its stories. */
import { HttpResponse, http } from 'msw';

const FACTS = [
  {
    timestamp: '2026-10-12T09:00:00.000Z',
    key: 'shared__2026-10-12',
    date: '2026-10-12',
    question: "What's the best pie?",
    answer: 'Apple, warm, with a slice of cheddar.',
    answered: true,
    skipped: false,
    questionType: 'shared',
  },
  {
    timestamp: '2026-10-05T09:00:00.000Z',
    key: 'shared__2026-10-05',
    date: '2026-10-05',
    question: "What's the best pie?",
    answer: 'Cherry.',
    answered: true,
    skipped: false,
    questionType: 'shared',
  },
  {
    timestamp: '2026-10-01T09:00:00.000Z',
    key: 'basic_2_2026-10-01',
    date: '2026-10-01',
    question: 'Where did you grow up?',
    answer: null,
    answered: false,
    skipped: true,
    questionType: 'basic',
    questionIndex: 2,
  },
];

const TRIVIA = [
  {
    timestamp: '2026-10-14T09:00:00.000Z',
    question: {
      question: 'Which planet is red?',
      choices: ['Mars', 'Venus', 'Jupiter', 'Saturn'],
      answer: 'Mars',
      category: 'Science & Nature',
      difficulty: 'normal',
    },
    selectedAnswer: 'Mars',
    correct: true,
    pointsEarned: 10,
  },
  {
    timestamp: '2026-10-13T09:00:00.000Z',
    question: {
      question: 'Which river is longest?',
      choices: ['Nile', 'Amazon', 'Yangtze', 'Danube'],
      answer: 'Nile',
      category: 'Geography & Travel',
      difficulty: 'hard',
    },
    selectedAnswer: 'Amazon',
    correct: false,
    isCatchingUp: true,
  },
];

const round = (roundId: string, status: 'active' | 'completed') => ({
  roundId,
  targetUserId: 'bob',
  targetUserName: 'Bob',
  question: "What is Bob's favourite pie?",
  realAnswer: status === 'completed' ? 'Apple' : null,
  choices: null,
  answeredAt: null,
  startedAt: '2026-10-18T09:00:00.000Z',
  expiresAt: '2026-10-20T09:00:00.000Z',
  status,
  guesses: {
    alice: {
      userId: 'alice',
      userName: 'Alice',
      guess: 'Apple',
      submittedAt: '2026-10-18T10:00:00.000Z',
    },
  },
});

const OPEN_PLAYS = [
  {
    userId: 'charlie',
    type: 'Casino Rush',
    game: 'casino-rush',
    status: 'active',
    questions: 5,
    answered: 2,
    startTime: '2026-10-19T18:00:00.000Z',
  },
];

const answer = (data: unknown) => HttpResponse.json({ ok: true, data });

export const dataHandlers = ({ empty = false } = {}) => [
  http.get('*/admin/user-facts', () => answer({ facts: empty ? [] : FACTS, success: true })),
  http.get('*/admin/user-trivia', () => answer({ history: empty ? [] : TRIVIA, success: true })),
  http.get('*/admin/game-sessions', () => answer({ sessions: empty ? [] : OPEN_PLAYS })),
  http.get('*/admin/family-feud', () =>
    answer({
      currentRound: empty ? null : round('2026-10-18_bob', 'active'),
      recentRounds: empty ? [] : [round('2026-10-11_bob', 'completed')],
    }),
  ),
];
