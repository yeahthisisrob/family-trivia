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
  FAMILY_CATEGORY,
  type FactAnswerEntry,
  type Family,
  isRemembered,
  mentionableRelations,
  type Question,
  wordsIn,
} from '@family-trivia/shared';
import { invokeBedrockPrompt } from './bedrock/core/bedrockClient';
import { POINT_MULTIPLIERS } from './bedrock/core/constants';
import { modelFor } from './bedrock/core/models';
import { collectResponseBody, extractJsonFromResponse } from './bedrock/core/responseParser';
import type { DifficultyLevel } from './bedrock/core/types';
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

async function answerQuestion(
  model: string,
  family: Family,
  playerName: string,
  sources: Source[],
  difficulty: DifficultyLevel,
  history: Question[],
): Promise<Question | null> {
  const names = Object.values(family.people)
    .filter((p) => !p.noAiMentions)
    .map(
      (p) =>
        `${p.name}${isRemembered(p) ? ' (remembered; speak of them gently, in the past tense)' : ''}`,
    );
  const prompt = `Write one multiple-choice trivia question for ${playerName} about their own family, using only these answers family members gave in the family app.

${sources.map((s) => `[${s.n}] ${s.name} was asked "${s.question}" and said: "${s.answer}"`).join('\n')}

Family members: ${names.join(', ')}

Good questions: "Who in the family said their happy place is the beach?" (choices are four family members' names), or "What did Grandma say she would miss the most?" (choices are four short answers, one of them what she said).
Difficulty: ${difficulty}.

Return only JSON: {"question": "...", "choices": ["...", "...", "...", "..."], "answer": "...", "source": <the [number] it comes from>}
- The answer must be one of the choices and must be true according to that answer. Invent nothing.
- The answer must not appear in the question.
- Never mention divorce, separation or former partners.`;
  const stream = await invokeBedrockPrompt(prompt, 400, 0.8, { task: 'trivia' }, model);
  const parsed = extractJsonFromResponse(await collectResponseBody(stream), model) as Record<
    string,
    unknown
  >;
  const source = sources.find((s) => s.n === Number(parsed.source));
  const choices = Array.isArray(parsed.choices)
    ? parsed.choices.filter((c): c is string => typeof c === 'string')
    : [];
  const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
  const answer = typeof parsed.answer === 'string' ? parsed.answer : '';
  if (!source || !question || choices.length !== 4 || !choices.includes(answer)) return null;
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
  const [{ visible: family }, histories] = await Promise.all([loadJoined(), getAllFactHistories()]);
  const connection = connectionQuestion(family, playerId, difficulty);
  if (connection && Math.random() < 0.25 && !isDuplicateQuestion(connection, history))
    return { question: connection, calls: 0 };

  const sources = sourcesFor(family, playerId, histories);
  if (sources.length >= 4) {
    const playerName = family.people[playerId]?.name ?? 'the player';
    const tries = await Promise.all(
      [modelFor('trivia'), modelFor('factCheck')].map((m) =>
        answerQuestion(m, family, playerName, sources, difficulty, history).catch(() => null),
      ),
    );
    const q = tries.find(Boolean);
    if (q) return { question: q, calls: 2 };
  }
  return connection && !isDuplicateQuestion(connection, history)
    ? { question: connection, calls: 0 }
    : null;
}
