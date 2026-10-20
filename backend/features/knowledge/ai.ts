/** The two AI steps of the knowledge index: read answers, write a persona. */
import {
  isKnowledgeKind,
  isMediaTag,
  itemKey,
  KNOWLEDGE_KINDS,
  type KnowledgeItem,
  type KnowledgeNote,
  type Love,
  MEDIA_TAGS,
  type PersonKnowledge,
  topItems,
} from '@family-trivia/shared';
import {
  askStructured,
  type Structured,
  unlessInvalid,
} from '../../services/bedrock/core/converse';
import { modelFor } from '../../services/bedrock/core/models';
import { hasListOf, isFilled, isRecord, listSchema } from '../../services/bedrock/core/shape';

export interface Said {
  at: string;
  question: string;
  answer: string;
}

type Answer<T> = Omit<Structured<T>, 'task' | 'prompt' | 'maxTokens'>;

function ask<T>(
  task: 'knowledge' | 'persona' | 'notes',
  prompt: string,
  maxTokens: number,
  answer: Answer<T>,
): Promise<T> {
  return askStructured({
    ...answer,
    task,
    prompt,
    maxTokens,
    temperature: 0.2,
    model: modelFor(task),
  });
}

const ITEMS: Answer<{ items: Record<string, unknown>[] }> = {
  name: 'knowledge_items',
  description: 'The specific things these answers talk about, one item each.',
  schema: listSchema(
    'items',
    {
      kind: { type: 'string', enum: KNOWLEDGE_KINDS.map((k) => k.id) },
      name: { type: 'string' },
      says: { type: 'string' },
      answer: { type: 'integer', description: 'The [number] it came from' },
      about: { type: 'string', description: 'The id, for a family member' },
      tag: { type: 'string', enum: [...MEDIA_TAGS], description: 'For media only' },
    },
    ['kind', 'name', 'says', 'answer'],
  ),
  check: (v): v is { items: Record<string, unknown>[] } => hasListOf(v, 'items'),
};

interface Persona {
  persona: string;
  traits?: string[];
}

/** A persona: some sentences, and maybe a list of short traits. */
export const isPersona = (v: unknown): v is Persona =>
  isRecord(v) &&
  isFilled(v.persona) &&
  (v.traits === undefined ||
    (Array.isArray(v.traits) && v.traits.every((t) => typeof t === 'string')));

const PERSONA: Answer<Persona> = {
  name: 'persona',
  description: 'Who they are, in a few sentences, and a handful of traits.',
  schema: {
    type: 'object',
    properties: {
      persona: { type: 'string' },
      traits: { type: 'array', items: { type: 'string' } },
    },
    required: ['persona'],
  },
  check: isPersona,
  why: (v) =>
    isRecord(v) && isFilled(v.persona)
      ? 'traits must be a list of strings'
      : 'the persona is empty',
};

const NOTES: Answer<{ notes: Record<string, unknown>[] }> = {
  name: 'did_you_know',
  description: 'One short, true "did you know" for each thing it is sure about.',
  schema: listSchema(
    'notes',
    {
      n: { type: 'integer', description: 'The [number] of the thing' },
      text: { type: 'string' },
    },
    ['n', 'text'],
  ),
  check: (v): v is { notes: Record<string, unknown>[] } => hasListOf(v, 'notes'),
};

/** Someone in the family, as the person answering knows them. */
export interface Relative {
  id: string;
  name: string;
  relation: string;
}

/** What these answers say about the person, item by item. */
export async function readAnswers(
  name: string,
  said: Said[],
  family: Relative[] = [],
): Promise<KnowledgeItem[]> {
  const known = family.length
    ? `\n${name}'s family, as ${name} knows them: ${family.map((r) => `${r.name} (their ${r.relation}, id ${r.id})`).join('; ')}.\nWhen an answer mentions one of them, by name or as "mom", "dad", "grandma", "aunt ..." and so on, add "about": their id to that person item. Only when it's clearly them; otherwise leave it out.\n`
    : '';
  const prompt = `Here are answers ${name} gave to questions in their family's app. Note the specific things they talk about.
${known}
Kinds: ${KNOWLEDGE_KINDS.map((k) => `${k.id} (${k.label.toLowerCase()})`).join(', ')}.

${said.map((s, i) => `[${i}] Q: ${s.question}\n    A: ${s.answer}`).join('\n')}

Return only JSON: {"items": [{"kind": "...", "name": "...", "says": "...", "answer": 0, "about": "id, for a family member", "tag": "for media only"}]}
- name: short, plain, lower case, the thing itself ("the beach", "apple pie", "grandma's garden").
- says: a few of their own words from the answer, at most 12, copied exactly.
- answer: the [number] it came from.
- tag (media only, when it's clear): ${MEDIA_TAGS.join(', ')}. A band or artist is "band".
- Only what the answers actually say. Skip jokes with nothing in them, and skip answers that say nothing about them.`;
  // An answer that never takes the right shape reads as nothing found, as before.
  const found = await unlessInvalid(ask('knowledge', prompt, 1500, ITEMS), { items: [] });
  const out: KnowledgeItem[] = [];
  for (const r of found.items) {
    const source = said[Number(r.answer)];
    if (!source || !isKnowledgeKind(r.kind) || typeof r.name !== 'string' || !r.name.trim())
      continue;
    const about =
      r.kind === 'person' && typeof r.about === 'string' && family.some((f) => f.id === r.about)
        ? r.about
        : undefined;
    out.push({
      kind: r.kind,
      name: r.name.trim().slice(0, 60),
      says: typeof r.says === 'string' ? r.says.trim().slice(0, 120) : '',
      from: source.at,
      ...(about ? { about } : {}),
      ...(r.kind === 'media' && isMediaTag(r.tag) ? { tag: r.tag } : {}),
    });
  }
  return out;
}

/** A few sentences on who they are, and a handful of traits, from the index alone. */
export async function writePersona(
  name: string,
  k: PersonKnowledge,
  remembered: boolean,
): Promise<NonNullable<PersonKnowledge['persona']>> {
  const top = topItems(k, 14)
    .map((t) => `${t.kind}: ${t.name} (${t.count}×)`)
    .join('; ');
  const quotes = k.items
    .filter((i) => i.says)
    .slice(-10)
    .map((i) => `"${i.says}"`)
    .join(' ');
  const prompt = `Write who ${name} is, for their page in their family's app, from what they talk about in their own answers.

What they talk about: ${top}
Their words: ${quotes}

Return only JSON: {"persona": "...", "traits": ["...", "..."]}
- persona: two or three warm, specific sentences in plain words${remembered ? `. ${name} has died and the family remembers them: write in the past tense, gently` : ''}.
- traits: three to five short ones ("loves the outdoors", "a planner").
- Only what is given; invent nothing. No lists or emojis in the persona.`;
  const found = await ask('persona', prompt, 400, PERSONA);
  return {
    text: found.persona.trim(),
    traits: (found.traits ?? []).slice(0, 5),
    at: new Date().toISOString(),
    items: k.items.length,
  };
}

/**
 * A short "did you know" for each of a few things they love: the band, the
 * place, the dish. Only what's well known; anything unsure is left out.
 */
export async function writeNotes(name: string, loves: Love[]): Promise<KnowledgeNote[]> {
  if (!loves.length) return [];
  const prompt = `${name} loves these, in their own words. For each, write one short, surprising, true "did you know" fact about the thing itself (not about ${name}), the kind a friend would enjoy hearing.

${loves.map((l, i) => `[${i}] ${l.kind}${l.tag ? ` (${l.tag})` : ''}: ${l.name}${l.says[0] ? `, they said "${l.says[0]}"` : ''}`).join('\n')}

Return only JSON: {"notes": [{"n": 0, "text": "..."}]}
- One or two sentences each, plain words, no emojis.
- Only facts you are sure of and that are widely known. If you aren't sure what it is, or it's personal ("my mom's lasagna"), skip it.
- Never invent dates, numbers or tour plans.`;
  const found = await unlessInvalid(ask('notes', prompt, 700, NOTES), { notes: [] });
  const at = new Date().toISOString();
  const out: KnowledgeNote[] = [];
  for (const r of found.notes) {
    const love = loves[Number(r.n)];
    if (love && typeof r.text === 'string' && r.text.trim())
      out.push({ key: itemKey(love.kind, love.name), text: r.text.trim().slice(0, 300), at });
  }
  return out;
}
