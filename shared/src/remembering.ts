/**
 * A remembered person's page: everything they told the family, the last of
 * it first, what the family loved most, and the family's memories of them
 * (comments with contentType 'memorial' and the person's id).
 */

/** One answer, with the id its comments and reactions hang on ({personId}_{timestamp}). */
export interface RememberedWord {
  id: string;
  question: string;
  answer: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface Remembering {
  personId: string;
  /** Every answer they gave, oldest first. */
  words: RememberedWord[];
  /** Ids of their last few answers, newest first. */
  last: string[];
  /** Their answers the family responded to most, most first. */
  loved: { id: string; reactions: number; comments: number }[];
  trivia: { played: number; right: number };
  /** First and last day they took part (YYYY-MM-DD). */
  span: { first: string | null; last: string | null };
}

/** How many of the last answers lead the page. */
export const LAST_WORDS = 5;

/** "May 2025 to April 2026", or one month when it's the same. */
export function spanLabel(span: Remembering['span'], locale?: string): string | null {
  if (!span.first || !span.last) return null;
  const month = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const [a, b] = [month(span.first), month(span.last)];
  return a === b ? a : `${a} to ${b}`;
}

/** Words grouped by month (YYYY-MM), oldest first, for reading through. */
export function byMonth(words: RememberedWord[]): { month: string; words: RememberedWord[] }[] {
  const out: { month: string; words: RememberedWord[] }[] = [];
  for (const w of words) {
    const month = w.date.slice(0, 7);
    const group = out.at(-1);
    if (group?.month === month) group.words.push(w);
    else out.push({ month, words: [w] });
  }
  return out;
}
