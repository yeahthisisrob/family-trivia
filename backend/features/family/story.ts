/**
 * The family's story: two or three warm paragraphs at the top of the Family
 * tab, written from the family's own answers. Only current ties, never a
 * former partner; nobody who opted out of AI mentions; people the family
 * remembers spoken of gently; nothing invented. Cached until an admin asks
 * for a fresh one.
 */
import {
  type Answer,
  type Family,
  householdsOf,
  likenesses,
  mentionableRelations,
} from '@family-trivia/shared';
import { askText } from '../../services/bedrock/core/converse';
import { modelFor } from '../../services/bedrock/core/models';
import { getJson, putJson } from '../../services/s3';

const KEY = 'family/story.json';

export interface FamilyStory {
  markdown: string | null;
  generatedAt: string | null;
  stats: {
    people: number;
    playing: number;
    households: number;
    answers: number;
    since: string | null;
  };
}

interface FactEntry {
  date?: string;
  question?: string;
  answer?: string;
  skipped?: boolean;
  questionType?: string;
}

async function familyAnswers(family: Family) {
  const ids = Object.keys(family.people);
  const lists = await Promise.all(
    ids.map((id) => getJson<FactEntry[]>(`facts/answers/${id}.json`)),
  );
  const byPerson = new Map<string, FactEntry[]>();
  ids.forEach((id, i) => {
    byPerson.set(
      id,
      (lists[i] ?? []).filter((f) => f.answer?.trim() && !f.skipped),
    );
  });
  return byPerson;
}

export async function storyStats(
  family: Family,
  byPerson?: Map<string, FactEntry[]>,
): Promise<FamilyStory['stats']> {
  const answers = byPerson ?? (await familyAnswers(family));
  const all = [...answers.values()].flat();
  const dates = all
    .map((f) => f.date)
    .filter((d): d is string => !!d)
    .sort();
  return {
    people: Object.keys(family.people).length,
    playing: Object.values(family.people).filter(
      (p) => p.participation === 'playing' && !p.memorial,
    ).length,
    households: Object.keys(family.households).length,
    answers: all.length,
    since: dates[0] ?? null,
  };
}

export async function readStory(family: Family): Promise<FamilyStory> {
  const stored = await getJson<{ markdown: string; generatedAt: string }>(KEY);
  return {
    markdown: stored?.markdown ?? null,
    generatedAt: stored?.generatedAt ?? null,
    stats: await storyStats(family),
  };
}

export async function writeStory(family: Family): Promise<FamilyStory> {
  const byPerson = await familyAnswers(family);
  const allowed = Object.values(family.people).filter((p) => !p.noAiMentions);

  const people = allowed
    .map((p) => {
      const homes = householdsOf(family, p.id).map((h) => h.name);
      const ties = mentionableRelations(family, p.id)
        .filter((r) =>
          ['partner', 'parent', 'child', 'sibling', 'grandparent', 'grandchild'].includes(
            r.relation,
          ),
        )
        .slice(0, 6)
        .map((r) => `${r.relation} of ${r.name}`);
      const said = (byPerson.get(p.id) ?? [])
        .filter((f) => f.questionType !== 'basic')
        .slice(-4)
        .map((f) => `"${f.question}" → "${f.answer}"`);
      const memory = p.memorial
        ? ` (remembered, died ${p.memorial.died ?? ''}${p.memorial.dedication ? `; the family says: "${p.memorial.dedication}"` : ''})`
        : '';
      return `- ${p.name}${memory}${homes.length ? `; home: ${homes.join(', ')}` : ''}${ties.length ? `; ${ties.join(', ')}` : ''}${said.length ? `\n  in their words: ${said.join(' | ')}` : ''}`;
    })
    .join('\n');

  const answers: Answer[] = [];
  for (const [id, list] of byPerson) {
    if (family.people[id]?.noAiMentions) continue;
    for (const f of list)
      if (f.question && f.questionType !== 'basic')
        answers.push({ personId: id, question: f.question, answer: f.answer as string });
  }
  const shared = likenesses(answers)
    .slice(0, 6)
    .map(
      (l) =>
        `${family.people[l.a]?.name} and ${family.people[l.b]?.name} answered alike ${l.count} times, e.g. "${l.examples[0]?.question}": "${l.examples[0]?.a}" / "${l.examples[0]?.b}"`,
    )
    .join('\n');

  const prompt = `You are writing the short story of a family for the top of their family page in a family trivia app they play together.

The family: ${family.name}
Households: ${
    Object.values(family.households)
      .map(
        (h) =>
          `${h.name} (${h.members
            .map((m) => family.people[m]?.name)
            .filter(Boolean)
            .join(', ')})`,
      )
      .join('; ') || 'not set'
  }

People:
${people}

What they share:
${shared || 'not enough answers yet'}

Write two or three short paragraphs, warm and specific, in plain words, as if a loving relative were describing the family to someone new. Use only what is given here; invent nothing. Mention a few real answers in their own words. If someone is remembered, speak of them gently and with love. Never mention divorce, separation, former partners or anyone not listed. No headings, no lists, no emojis. Markdown italics are fine.`;

  const text = await askText({
    task: 'familyStory',
    prompt,
    maxTokens: 900,
    temperature: 0.7,
    model: modelFor('familyStory'),
  });
  if (!text) throw new Error('The model returned no story');
  const generatedAt = new Date().toISOString();
  await putJson(KEY, { markdown: text, generatedAt });
  return { markdown: text, generatedAt, stats: await storyStats(family, byPerson) };
}
