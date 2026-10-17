/**
 * The family's knowledge index: what each person talks about, pulled from
 * their own answers by AI, each item tied to the answer it came from. The
 * index grows a few answers at a time; personas and the family's shared
 * themes are read from it. Statistics are counted, not guessed.
 */

export const KNOWLEDGE_KINDS = [
  { id: 'place', label: 'Places' },
  { id: 'food', label: 'Food' },
  { id: 'person', label: 'People' },
  { id: 'pet', label: 'Pets and animals' },
  { id: 'activity', label: 'Things they do' },
  { id: 'media', label: 'Music, books and shows' },
  { id: 'work', label: 'Work and school' },
  { id: 'value', label: 'What matters to them' },
  { id: 'memory', label: 'Memories' },
] as const;

export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number]['id'];
export const isKnowledgeKind = (v: unknown): v is KnowledgeKind =>
  typeof v === 'string' && KNOWLEDGE_KINDS.some((k) => k.id === v);

export interface KnowledgeItem {
  kind: KnowledgeKind;
  /** Short and plain, lower case: "the beach", "apple pie", "gardening". */
  name: string;
  /** Their own words, a few at most. */
  says: string;
  /** The answer it came from: its timestamp. */
  from: string;
  /** For a person they mention: who it is in the family ("mom" from her son is her). */
  about?: string;
}

/** As stored: knowledge/people/{personId}.json */
export interface PersonKnowledge {
  personId: string;
  /** Timestamps of the answers already read. */
  read: string[];
  items: KnowledgeItem[];
  persona: { text: string; traits: string[]; at: string; items: number } | null;
  updatedAt: string;
}

export interface FamilyTheme {
  name: string;
  kind: KnowledgeKind;
  people: string[];
  quotes: { personId: string; says: string }[];
}

export interface PersonStats {
  answers: number;
  words: number;
  /** Most days in a row they answered. */
  bestStreak: number;
  first: string | null;
}

export interface FamilyKnowledge {
  themes: FamilyTheme[];
  people: Record<
    string,
    {
      top: { name: string; kind: KnowledgeKind; count: number }[];
      persona: PersonKnowledge['persona'];
      stats: PersonStats;
    }
  >;
  stats: {
    answers: number;
    words: number;
    people: number;
    busiestDay: string | null;
    longestAnswer: { personId: string; question: string; words: number } | null;
  };
  /** How many answers are waiting to be read into the index. */
  unread: number;
  builtAt: string | null;
}

/** "The Beach!" and "beach" are the same thing. */
export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/^(the|a|an|my|our) /, '')
    .replace(/\s+/g, ' ')
    .trim();

/** What more than one person talks about, most shared first. */
export function familyThemes(people: PersonKnowledge[], min = 2): FamilyTheme[] {
  const byName = new Map<string, FamilyTheme>();
  for (const p of people)
    for (const item of p.items) {
      const key = `${item.kind}:${normalizeName(item.name)}`;
      if (!key.endsWith(':')) {
        const t = byName.get(key) ?? {
          name: normalizeName(item.name),
          kind: item.kind,
          people: [],
          quotes: [],
        };
        if (!t.people.includes(p.personId)) {
          t.people.push(p.personId);
          t.quotes.push({ personId: p.personId, says: item.says });
        }
        byName.set(key, t);
      }
    }
  return [...byName.values()]
    .filter((t) => t.people.length >= min && t.kind !== 'person')
    .sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
}

/** The things a person comes back to most. */
export function topItems(p: PersonKnowledge, n = 8) {
  const counts = new Map<string, { name: string; kind: KnowledgeKind; count: number }>();
  for (const i of p.items) {
    const key = `${i.kind}:${normalizeName(i.name)}`;
    const c = counts.get(key) ?? { name: normalizeName(i.name), kind: i.kind, count: 0 };
    c.count++;
    counts.set(key, c);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** Most days in a row with an answer, from YYYY-MM-DD dates. */
export function bestStreak(dates: string[]): number {
  const days = [...new Set(dates)].sort().map((d) => Date.parse(`${d}T00:00:00Z`) / 86_400_000);
  let best = 0;
  let run = 0;
  let prev: number | undefined;
  for (const day of days) {
    run = prev !== undefined && day - prev === 1 ? run + 1 : 1;
    prev = day;
    best = Math.max(best, run);
  }
  return best;
}
