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

/** How the book is written around the family's answers. */
export type BookTone = 'plain' | 'warm' | 'playful';

export const BOOK_TONES: readonly { id: BookTone; label: string; help: string }[] = [
  { id: 'plain', label: 'Just our words', help: 'Every answer, nothing added.' },
  {
    id: 'warm',
    label: 'Warm',
    help: 'A foreword, and chapters by theme, each opening with the story of our answers.',
  },
  {
    id: 'playful',
    label: 'Playful',
    help: 'The same, lighter: the running jokes and the surprises.',
  },
];

export const isBookTone = (v: unknown): v is BookTone =>
  typeof v === 'string' && BOOK_TONES.some((t) => t.id === v);

/** A chapter of a written book: a theme the AI found, its days, and its opening. */
export interface BookChapter {
  title: string;
  /** The days in it, as pageKey()s, in reading order. */
  pages: string[];
  /** A few paragraphs telling the chapter's story; null until written. */
  intro: string | null;
}

/** What the AI wrote for a season's book: kept, so it's written once per tone. */
export interface BookWriting {
  tone: BookTone;
  foreword: string;
  /** Earlier books: a few lines opening each month (YYYY-MM). */
  chapters: Record<string, string>;
  /** The chapters by theme, each with its own opening. */
  plan?: BookChapter[];
  writtenAt: string;
}

/** A day's page, as a chapter lists it. */
export const pageKey = (p: Pick<BookPage, 'date' | 'question'>) => `${p.date}|${p.question}`;

/** How many chapters still need their opening written. */
export const chaptersLeft = (w: BookWriting | null | undefined): number =>
  w?.plan ? w.plan.filter((c) => !c.intro).length : Number.POSITIVE_INFINITY;

/** A finished book, ready to download. */
export interface SeasonBook {
  url: string;
  pages: number;
  tone: BookTone;
  madeAt: string;
  /** False when the kept copy was still current and nothing was made. */
  made: boolean;
  /** Its wraparound cover (back, spine and front), sized for its page count. */
  coverUrl?: string;
}

/** One book that was made. Every version is kept; none is replaced. */
export interface BookVersion {
  tone: BookTone;
  madeAt: string;
  pages: number;
  /** When its writing was written; null for just our words. */
  writtenAt: string | null;
  url: string;
  coverUrl?: string;
}
