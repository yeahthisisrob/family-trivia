/**
 * The first questions a new person answers, one a day, before the circle's
 * shared questions (docs/decisions/0028). A circle with its own list
 * (config/basic_questions.json) keeps it; every other circle starts with the
 * set for its kind. Short and easy, and each one tells the circle something
 * it can use: a birthday to celebrate, what someone loves.
 */
import type { CircleKind } from './circle';

/** The first is always the birthday: Celebrations reads question 0 as it. */
const STARTERS: Record<CircleKind, string[]> = {
  family: [
    'When is your birthday? (MM/DD)',
    'Where did you grow up?',
    'What is a family tradition you love?',
    'What is your go-to comfort food?',
    'What band or artist have you had on repeat lately?',
  ],
  friends: [
    'When is your birthday? (MM/DD)',
    'Where do you live these days?',
    'What band or artist have you had on repeat lately?',
    "What's your go-to order at your favorite spot?",
    "What's a trip you still talk about?",
  ],
  mixed: [
    'When is your birthday? (MM/DD)',
    'Where do you live these days?',
    'What band or artist have you had on repeat lately?',
    'What is your go-to comfort food?',
    "What's a trip you still talk about?",
  ],
};

export const startersFor = (kind: CircleKind = 'family'): string[] => STARTERS[kind];
