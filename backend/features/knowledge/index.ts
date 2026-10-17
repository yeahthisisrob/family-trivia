/**
 * Building and reading the knowledge index (shared/src/knowledge.ts).
 * Building reads a batch of new answers per person and stops before the
 * request runs long; the admin page calls again until nothing is left.
 * Nobody who opted out of AI mentions is read; nobody who hasn't joined.
 */
import {
  bestStreak,
  type FactAnswerEntry,
  type Family,
  type FamilyKnowledge,
  familyThemes,
  mentionableRelations,
  type PersonKnowledge,
  topItems,
  wordsIn,
} from '@family-trivia/shared';
import { getAllFactHistories } from '../../services/factHistoryService';
import { loadJoined } from '../../services/family/joined';
import { knowledgeKey, readKnowledge } from '../../services/knowledge';
import { logger } from '../../services/logger';
import { getJson, putJson } from '../../services/s3';
import { readAnswers, type Said, writePersona } from './ai';

const personKey = knowledgeKey;
const META_KEY = 'knowledge/meta.json';
const BATCH = 30;
/** Rewrite a persona once the index has grown this much since the last one. */
const PERSONA_GROWTH = 8;

const real = (e: FactAnswerEntry) => e.answered && !e.skipped && !!e.answer?.trim();

export const readPerson = readKnowledge;

function indexable(family: Family, joined: Set<string>) {
  return Object.values(family.people).filter((p) => joined.has(p.id) && !p.noAiMentions);
}

function unreadOf(k: PersonKnowledge, answers: FactAnswerEntry[]): Said[] {
  const read = new Set(k.read);
  return answers
    .filter((e) => real(e) && !read.has(e.editedAt ?? e.timestamp))
    .map((e) => ({ at: e.timestamp, question: e.question, answer: e.answer }));
}

/**
 * Read up to one batch of new answers for each person, then refresh the
 * personas that grew. Stops starting new people after `budgetMs`.
 */
export async function buildSome(budgetMs = 12_000) {
  const started = Date.now();
  const [{ family, joined }, histories] = await Promise.all([loadJoined(), getAllFactHistories()]);
  const people = indexable(family, joined);
  let readNow = 0;
  let personas = 0;
  const failures: string[] = [];

  for (const p of people) {
    if (Date.now() - started > budgetMs) break;
    const answers = histories.get(p.id) ?? [];
    const k = await readPerson(p.id);
    const unread = unreadOf(k, answers);
    try {
      if (unread.length) {
        const batch = unread.slice(0, BATCH);
        const items = await readAnswers(p.name, batch, mentionableRelations(family, p.id));
        const edited = new Set(batch.map((b) => b.at));
        // An answer added to is read again; its older items give way.
        k.items = [...k.items.filter((i) => !edited.has(i.from)), ...items];
        const byAt = new Map(answers.map((e) => [e.timestamp, e]));
        k.read = [...k.read, ...batch.map((b) => byAt.get(b.at)?.editedAt ?? b.at)];
        readNow += batch.length;
      }
      if (k.items.length && (!k.persona || k.items.length - k.persona.items >= PERSONA_GROWTH)) {
        k.persona = await writePersona(p.name, k, !!p.memorial);
        personas++;
      }
      k.updatedAt = new Date().toISOString();
      await putJson(personKey(p.id), k);
    } catch (err) {
      failures.push(p.id);
      logger.error('Knowledge index step failed', {
        personId: p.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const left = await unreadCount(family, joined, histories);
  await putJson(META_KEY, { builtAt: new Date().toISOString() });
  return { read: readNow, personas, left, failures };
}

async function unreadCount(
  family: Family,
  joined: Set<string>,
  histories: Map<string, FactAnswerEntry[]>,
) {
  let n = 0;
  for (const p of indexable(family, joined))
    n += unreadOf(await readPerson(p.id), histories.get(p.id) ?? []).length;
  return n;
}

/** Everything the Family tab shows from the index, and the counted statistics. */
export async function familyKnowledge(): Promise<FamilyKnowledge> {
  const [{ family, joined }, histories, meta] = await Promise.all([
    loadJoined(),
    getAllFactHistories(),
    getJson<{ builtAt: string }>(META_KEY),
  ]);
  const visible = Object.values(family.people).filter((p) => joined.has(p.id));
  const knowledge = await Promise.all(
    visible.filter((p) => !p.noAiMentions).map((p) => readPerson(p.id)),
  );

  const days = new Map<string, number>();
  let answers = 0;
  let words = 0;
  let longest: FamilyKnowledge['stats']['longestAnswer'] = null;
  const people: FamilyKnowledge['people'] = {};

  for (const p of visible) {
    const mine = (histories.get(p.id) ?? []).filter(real);
    const w = mine.reduce((n, e) => n + wordsIn(e.answer), 0);
    answers += mine.length;
    words += w;
    for (const e of mine) {
      const day = new Date(e.timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'America/New_York',
      });
      days.set(day, (days.get(day) ?? 0) + 1);
      const n = wordsIn(e.answer);
      if (!p.noAiMentions && (!longest || n > longest.words))
        longest = { personId: p.id, question: e.question, words: n };
    }
    const k = knowledge.find((x) => x.personId === p.id);
    people[p.id] = {
      top: k ? topItems(k) : [],
      persona: k?.persona ?? null,
      stats: {
        answers: mine.length,
        words: w,
        bestStreak: bestStreak(mine.map((e) => e.date).filter(Boolean)),
        first: mine.map((e) => e.date).sort()[0] ?? null,
      },
    };
  }

  return {
    themes: familyThemes(knowledge).slice(0, 24),
    people,
    stats: {
      answers,
      words,
      people: visible.length,
      busiestDay: [...days].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      longestAnswer: longest,
    },
    unread: await unreadCount(family, joined, histories),
    builtAt: meta?.builtAt ?? null,
  };
}
