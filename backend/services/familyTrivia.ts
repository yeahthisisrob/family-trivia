/**
 * Trivia about the family itself (the Our Family category, docs/decisions/0010).
 *
 * Two kinds of question:
 * - Connections, built straight from the family's ties with no AI: "Who is
 *   Jo's grandparent?" Only current ties (never a former partner), and only
 *   people who have joined and haven't opted out of being mentioned.
 * - Answers, written by AI from what other people in the family said. The
 *   model must say which answer the question comes from, and the code checks
 *   the correct choice really is in it, so nothing is invented. The player's
 *   own answers are never used: they'd know them.
 */
import {
  type AiFrame,
  circleCategoryFor,
  FAMILY_CATEGORY,
  type FactAnswerEntry,
  type Family,
  type Friendship,
  isRemembered,
  MET_LABEL,
  type MetHow,
  mentionableRelations,
  type Question,
  wordsIn,
} from '@family-trivia/shared';
import { POINT_MULTIPLIERS } from './bedrock/core/constants';
import { askStructured, unlessInvalid } from './bedrock/core/converse';
import { circleFrame } from './bedrock/core/frame';
import { modelFor } from './bedrock/core/models';
import type { DifficultyLevel } from './bedrock/core/types';
import {
  CHOICE_QUESTION_FIELDS,
  type ChoiceQuestion,
  isChoiceQuestion,
} from './bedrock/questions/choiceQuestion';
import { isDuplicateQuestion } from './bedrock/questions/utils';
import { getAllFactHistories } from './factHistoryService';
import { loadJoined } from './family/joined';
import { logger } from './logger';

const CONNECTIONS = [
  'parent',
  'child',
  'sibling',
  'half-sibling',
  'stepparent',
  'stepchild',
  'stepsibling',
  'grandparent',
  'grandchild',
  'partner',
  'cousin',
  'aunt or uncle',
  'niece or nephew',
];
const shuffle = <T>(xs: T[], rand = Math.random) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
};

const finish = (q: Omit<Question, 'category'>, difficulty: DifficultyLevel): Question => ({
  ...q,
  category: FAMILY_CATEGORY.name,
  difficulty,
  pointMultiplier: POINT_MULTIPLIERS[difficulty],
});

/** A who-is-whose question from the family's ties, or null when the family has too few. */
export function connectionQuestion(
  family: Family,
  playerId: string,
  difficulty: DifficultyLevel,
  rand = Math.random,
): Question | null {
  const people = Object.values(family.people).filter((p) => !p.noAiMentions);
  for (const subject of shuffle(
    people.filter((p) => p.id !== playerId),
    rand,
  )) {
    const ties = mentionableRelations(family, subject.id).filter((r) =>
      CONNECTIONS.includes(r.relation),
    );
    for (const tie of shuffle(ties, rand)) {
      const sameTie = new Set(ties.filter((t) => t.relation === tie.relation).map((t) => t.id));
      const others = shuffle(
        people.filter((p) => p.id !== subject.id && !sameTie.has(p.id)),
        rand,
      ).slice(0, 3);
      if (others.length < 3) continue;
      const was = isRemembered(subject) ? 'was' : 'is';
      return finish(
        {
          question: `Who ${was} ${subject.name}'s ${tie.relation}?`,
          choices: shuffle([tie.name, ...others.map((o) => o.name)], rand),
          answer: tie.name,
          type: 'connection',
        },
        difficulty,
      );
    }
  }
  return friendQuestion(family, playerId, difficulty, rand);
}

/** "Who did Alice meet in college?", from how friends said they met (Threads, 0022). */
function friendQuestion(
  family: Family,
  playerId: string,
  difficulty: DifficultyLevel,
  rand: () => number,
): Question | null {
  const ok = (id: string) => family.people[id] && !family.people[id].noAiMentions;
  const met = family.ties.filter(
    (t): t is Friendship => t.type === 'friend' && !!t.met?.how && ok(t.a) && ok(t.b),
  );
  for (const t of shuffle(met, rand)) {
    const [subject, answer] = shuffle([t.a, t.b], rand);
    if (subject === playerId) continue;
    const how = t.met?.how as MetHow;
    // Anyone else this person met the same way would also be right: leave them out.
    const same = new Set(
      met
        .filter((x) => x.met?.how === how && (x.a === subject || x.b === subject))
        .flatMap((x) => [x.a, x.b]),
    );
    const others = shuffle(
      Object.values(family.people).filter((p) => ok(p.id) && !same.has(p.id)),
      rand,
    ).slice(0, 3);
    if (others.length < 3) continue;
    const name = (id: string) => family.people[id]?.name ?? id;
    return finish(
      {
        question: `Who did ${name(subject)} meet ${MET_LABEL[how]}?`,
        choices: shuffle([name(answer), ...others.map((o) => o.name)], rand),
        answer: name(answer),
        type: 'connection',
      },
      difficulty,
    );
  }
  return null;
}

interface Source {
  n: number;
  personId: string;
  name: string;
  question: string;
  answer: string;
}

function sourcesFor(
  family: Family,
  playerId: string,
  histories: Map<string, FactAnswerEntry[]>,
  count = 14,
) {
  const all: Omit<Source, 'n'>[] = [];
  for (const p of Object.values(family.people)) {
    if (p.id === playerId || p.noAiMentions) continue;
    for (const e of histories.get(p.id) ?? [])
      if (e.answered && !e.skipped && wordsIn(e.answer) >= 2)
        all.push({ personId: p.id, name: p.name, question: e.question, answer: e.answer });
  }
  return shuffle(all)
    .slice(0, count)
    .map((s, n) => ({ ...s, n }));
}

const significant = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3);

/** The correct choice really comes from the cited answer: the person's name, or words from what they said. */
export function groundedIn(q: { answer: string }, source: Source): boolean {
  if (q.answer.trim().toLowerCase() === source.name.toLowerCase()) return true;
  const said = new Set(significant(source.answer));
  const words = significant(q.answer);
  return words.length > 0 && words.filter((w) => said.has(w)).length / words.length >= 0.5;
}

const SOURCED_SCHEMA = {
  type: 'object',
  properties: {
    ...CHOICE_QUESTION_FIELDS,
    source: { type: 'integer', description: 'The [number] of the answer it comes from' },
  },
  required: ['question', 'choices', 'answer', 'source'],
};

/** A choice question that says which answer it comes from. */
export const isSourcedQuestion = (v: unknown): v is ChoiceQuestion & { source: number } =>
  isChoiceQuestion(v) && Number.isInteger((v as { source?: unknown }).source);

async function answerQuestion(
  model: string,
  family: Family,
  playerName: string,
  sources: Source[],
  difficulty: DifficultyLevel,
  history: Question[],
  frame: AiFrame,
): Promise<Question | null> {
  const names = Object.values(family.people)
    .filter((p) => !p.noAiMentions)
    .map(
      (p) =>
        `${p.name}${isRemembered(p) ? ' (remembered; speak of them gently, in the past tense)' : ''}`,
    );
  const prompt = `Write one multiple-choice trivia question for ${playerName} about their own ${frame.own}, ${frame.audience}, using only these answers ${frame.members} gave in the app.

${sources.map((s) => `[${s.n}] ${s.name} was asked "${s.question}" and said: "${s.answer}"`).join('\n')}

${frame.members[0].toUpperCase()}${frame.members.slice(1)}: ${names.join(', ')}

Good questions: "Who said their happy place is the beach?" (choices are four of their names), or "What did ${names[0]?.split(' (')[0] ?? 'Sam'} say they would miss the most?" (choices are four short answers, one of them what was said).
${frame.avoid}
Difficulty: ${difficulty}.

Return only JSON: {"question": "...", "choices": ["...", "...", "...", "..."], "answer": "...", "source": <the [number] it comes from>}
- The answer must be one of the choices and must be true according to that answer. Invent nothing.
- The answer must not appear in the question.
- Never mention divorce, separation or former partners.`;
  // An answer that never takes the right shape is no question, as before.
  const parsed = await unlessInvalid(
    askStructured({
      task: 'trivia',
      prompt,
      maxTokens: 400,
      temperature: 0.8,
      model,
      name: 'family_question',
      description: 'The question, four choices, the correct one and the [number] it comes from.',
      schema: SOURCED_SCHEMA,
      check: isSourcedQuestion,
    }),
    null,
  );
  const source = parsed && sources.find((s) => s.n === parsed.source);
  if (!parsed || !source) return null;
  const question = parsed.question.trim();
  const { choices, answer } = parsed;
  if (question.toLowerCase().includes(answer.toLowerCase()) || !groundedIn({ answer }, source)) {
    logger.info('Family question not grounded in its answer; dropped', {
      question: question.slice(0, 60),
    });
    return null;
  }
  const q = finish({ question, choices, answer, type: 'family-answer' }, difficulty);
  return isDuplicateQuestion(q, history) ? null : q;
}

/**
 * A question about the family for this player. About one in four is a
 * connection question when the family's ties allow; the rest come from
 * answers. Null when the family hasn't shared enough yet.
 */
export async function familyQuestion(
  playerId: string,
  difficulty: DifficultyLevel,
  history: Question[],
): Promise<{ question: Question; calls: number } | null> {
  const [{ visible: family }, histories, frame] = await Promise.all([
    loadJoined(),
    getAllFactHistories(),
    circleFrame(),
  ]);
  // Named for the circle: "Our Family", "Our Crew" (docs/decisions/0028).
  const ours = circleCategoryFor(frame.kind).name;
  const named = (q: Question): Question => ({ ...q, category: ours });
  const connection = connectionQuestion(family, playerId, difficulty);
  if (connection && Math.random() < 0.25 && !isDuplicateQuestion(connection, history))
    return { question: named(connection), calls: 0 };

  const sources = sourcesFor(family, playerId, histories);
  if (sources.length >= 4) {
    const playerName = family.people[playerId]?.name ?? 'the player';
    const tries = await Promise.all(
      [modelFor('trivia'), modelFor('factCheck')].map((m) =>
        answerQuestion(m, family, playerName, sources, difficulty, history, frame).catch(
          () => null,
        ),
      ),
    );
    const q = tries.find(Boolean);
    if (q) return { question: named(q), calls: 2 };
  }
  return connection && !isDuplicateQuestion(connection, history)
    ? { question: named(connection), calls: 0 }
    : null;
}
