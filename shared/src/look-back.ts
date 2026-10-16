/**
 * Looking back on a season: the family's answers gathered into something to
 * read together. The questions most of us answered, what the family loved,
 * everyone's season, and every day's question with everyone's answers (the
 * season's book).
 */

export interface SaidBy {
  personId: string;
  answer: string;
}

/** One day's shared question and everyone's answers to it. */
export interface BookPage {
  /** YYYY-MM-DD */
  date: string;
  question: string;
  answers: SaidBy[];
}

export interface SeasonReview {
  season: { number: number; name: string; startDate: string; endDate: string | null };
  /** Every season, newest first, for choosing another. */
  seasons: { number: number; name: string }[];
  numbers: {
    people: number;
    answers: number;
    words: number;
    trivia: number;
    comments: number;
    reactions: number;
    /** Days with at least one answer. */
    days: number;
  };
  /** The questions the most people answered. */
  together: BookPage[];
  /** The answers the family responded to most. */
  loved: {
    id: string;
    personId: string;
    question: string;
    answer: string;
    reactions: number;
    comments: number;
  }[];
  /** Each person's season, most answers first. */
  people: {
    personId: string;
    answers: number;
    words: number;
    trivia: number;
    right: number;
    points: number;
  }[];
  /** Every day's question with everyone's answers, oldest first. */
  book: BookPage[];
}

/** How many questions lead "the questions we all answered". */
export const TOGETHER = 5;
/** How many answers "what we loved" shows. */
export const LOVED = 6;
