/**
 * Who answered alike: for each question several people answered, compare
 * their answers and connect people who said the same kind of thing. The
 * evidence (the question and both answers) travels with the connection, so
 * the graph can say *why* two people are linked: "both said the beach".
 *
 * Plain word overlap, no AI: fast, explainable, and it never leaves the
 * family's storage.
 */

export interface Answer {
  personId: string;
  question: string;
  answer: string;
}

export interface Likeness {
  a: string;
  b: string;
  /** How many questions they answered alike. */
  count: number;
  /** 0..1: answered alike, out of the questions both answered. */
  strength: number;
  examples: { question: string; a: string; b: string }[];
}

const STOP = new Set(
  'a an and the of to in on at for with my me i im we our your is are was were be been it its this that these those or but so very really just like love lot lots always would could should do does did have has had not no yes from by as about over into out up down than then too also all any some more most much many favorite favourite probably definitely maybe one two thing things'.split(
    ' ',
  ),
);

/** Words that carry meaning, lowercased and lightly stemmed. */
export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)),
  );
}

/** Two answers say the same kind of thing. */
export function alike(x: string, y: string): boolean {
  const a = keywords(x);
  const b = keywords(y);
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  if (!shared) return false;
  return shared / (a.size + b.size - shared) >= 0.3 || shared >= 2;
}

export function likenesses(answers: Answer[], maxExamples = 3): Likeness[] {
  const byQuestion = new Map<string, Answer[]>();
  for (const ans of answers) {
    if (!ans.answer?.trim()) continue;
    const list = byQuestion.get(ans.question) ?? [];
    list.push(ans);
    byQuestion.set(ans.question, list);
  }

  const pairs = new Map<string, Likeness & { both: number }>();
  const key = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

  for (const [question, list] of byQuestion) {
    const latest = new Map<string, Answer>();
    for (const ans of list) latest.set(ans.personId, ans);
    const people = [...latest.values()];
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const x = people[i] as Answer;
        const y = people[j] as Answer;
        if (x.personId === y.personId) continue;
        const [a, b] = x.personId < y.personId ? [x, y] : [y, x];
        const k = key(a.personId, b.personId);
        const p = pairs.get(k) ?? {
          a: a.personId,
          b: b.personId,
          count: 0,
          strength: 0,
          both: 0,
          examples: [],
        };
        p.both++;
        if (alike(a.answer, b.answer)) {
          p.count++;
          if (p.examples.length < maxExamples)
            p.examples.push({ question, a: a.answer, b: b.answer });
        }
        pairs.set(k, p);
      }
    }
  }

  return [...pairs.values()]
    .filter((p) => p.count > 0)
    .map(({ both, ...p }) => ({ ...p, strength: Math.round((p.count / both) * 100) / 100 }))
    .sort((x, y) => y.count - x.count || y.strength - x.strength);
}
