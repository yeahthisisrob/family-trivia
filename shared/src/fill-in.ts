/**
 * Filling in: the questions a person missed, skipped, or answered briefly,
 * and how full their answers run next to the family's. Pure, so the rules
 * are tested on their own; the backend slice does the reading and writing.
 */
import type { FactAnswerEntry } from './facts';

export type FillInState = 'missing' | 'skipped' | 'brief' | 'full';

export interface FillInQuestion {
  /** "shared:YYYY-MM-DD" or "basic:N" */
  key: string;
  questionType: 'shared' | 'basic';
  date?: string;
  questionIndex?: number;
  question: string;
}

export interface FillInItem extends FillInQuestion {
  answer: string | null;
  words: number;
  /** Middle answer length among everyone else who answered. */
  familyWords: number;
  familyAnswered: number;
  state: FillInState;
  /** How many times they've added to it. */
  added: number;
}

export interface FillInView {
  items: FillInItem[];
  /** Keys of the few most worth going back to, best first. */
  suggested: string[];
  summary: {
    answered: number;
    total: number;
    yourWords: number;
    familyWords: number;
    /** Your answers next to the family's: shorter, about the same, or fuller. */
    depth: 'shorter' | 'similar' | 'fuller';
  };
}

export const wordsIn = (s: string | null | undefined): number =>
  s ? s.trim().split(/\s+/).filter(Boolean).length : 0;

export const keyOf = (e: Pick<FactAnswerEntry, 'questionType' | 'date' | 'questionIndex'>) =>
  e.questionType === 'basic' ? `basic:${e.questionIndex}` : `shared:${e.date}`;

export const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2
    ? (s[m] as number)
    : Math.round(((s[m - 1] as number) + (s[m] as number)) / 2);
};

const real = (e: FactAnswerEntry | undefined) => !!e && e.answered && !e.skipped && !!e.answer;

/** Brief: under half the family's usual length, or a few words when they wrote more. */
const isBrief = (words: number, familyWords: number) =>
  familyWords >= 6 && words < Math.max(4, familyWords / 2);

export function fillInView(
  meId: string,
  questions: FillInQuestion[],
  answers: Map<string, FactAnswerEntry[]>,
  SUGGEST = 5,
): FillInView {
  const byKey = new Map<string, Map<string, FactAnswerEntry>>();
  for (const [person, list] of answers)
    for (const e of list) {
      const k = keyOf(e);
      if (!byKey.has(k)) byKey.set(k, new Map());
      const prev = byKey.get(k)!.get(person);
      if (!prev || real(e) || !real(prev)) byKey.get(k)!.set(person, e);
    }

  const items: FillInItem[] = questions.map((q) => {
    const all = byKey.get(q.key) ?? new Map<string, FactAnswerEntry>();
    const mine = all.get(meId);
    const others = [...all]
      .filter(([id, e]) => id !== meId && real(e))
      .map(([, e]) => wordsIn(e.answer));
    const words = real(mine) ? wordsIn(mine!.answer) : 0;
    const familyWords = median(others);
    const state: FillInState = !mine
      ? 'missing'
      : !real(mine)
        ? 'skipped'
        : isBrief(words, familyWords)
          ? 'brief'
          : 'full';
    return {
      ...q,
      answer: real(mine) ? mine!.answer : null,
      words,
      familyWords,
      familyAnswered: others.length,
      state,
      added: mine?.earlier?.length ?? 0,
    };
  });

  const worth = (i: FillInItem) =>
    i.state === 'full'
      ? -1
      : i.state === 'brief'
        ? 10 + (i.familyWords - i.words)
        : 20 + i.familyAnswered * 3; // missed ones the family talked about most come first
  const suggested = items
    .filter((i) => i.state !== 'full' && (i.familyAnswered > 0 || i.questionType === 'basic'))
    .sort((a, b) => worth(b) - worth(a))
    .slice(0, SUGGEST)
    .map((i) => i.key);

  const answered = items.filter((i) => i.answer !== null);
  const yourWords = median(answered.map((i) => i.words));
  const familyWords = median(answered.map((i) => i.familyWords).filter((n) => n > 0));
  const ratio = familyWords ? yourWords / familyWords : 1;
  return {
    items,
    suggested,
    summary: {
      answered: answered.length,
      total: items.length,
      yourWords,
      familyWords,
      depth: ratio < 0.7 ? 'shorter' : ratio > 1.4 ? 'fuller' : 'similar',
    },
  };
}
