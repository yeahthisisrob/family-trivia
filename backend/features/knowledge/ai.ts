/** The two AI steps of the knowledge index: read answers, write a persona. */
import {
  isKnowledgeKind,
  KNOWLEDGE_KINDS,
  type KnowledgeItem,
  type PersonKnowledge,
  topItems,
} from '@family-trivia/shared';
import { invokeBedrockPrompt } from '../../services/bedrock/core/bedrockClient';
import { findJsonWithKey } from '../../services/bedrock/core/jsonInText';
import { modelFor } from '../../services/bedrock/core/models';
import { collectResponseBody } from '../../services/bedrock/core/responseParser';
import { extractTextContent } from '../../services/bedrock/core/textExtractor';

export interface Said {
  at: string;
  question: string;
  answer: string;
}

async function ask(task: 'knowledge' | 'persona', prompt: string, maxTokens: number) {
  const model = modelFor(task);
  const stream = await invokeBedrockPrompt(prompt, maxTokens, 0.2, { task }, model);
  return extractTextContent(await collectResponseBody(stream), model, task);
}

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

Return only JSON: {"items": [{"kind": "...", "name": "...", "says": "...", "answer": 0, "about": "id, for a family member"}]}
- name: short, plain, lower case, the thing itself ("the beach", "apple pie", "grandma's garden").
- says: a few of their own words from the answer, at most 12, copied exactly.
- answer: the [number] it came from.
- Only what the answers actually say. Skip jokes with nothing in them, and skip answers that say nothing about them.`;
  const text = await ask('knowledge', prompt, 1500);
  const found = findJsonWithKey<{ items?: unknown[] }>(text, 'items');
  const out: KnowledgeItem[] = [];
  for (const raw of found?.value.items ?? []) {
    const r = raw as Record<string, unknown>;
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
  const text = await ask('persona', prompt, 400);
  const found = findJsonWithKey<{ persona?: unknown; traits?: unknown }>(text, 'persona');
  const persona = typeof found?.value.persona === 'string' ? found.value.persona.trim() : '';
  if (!persona) throw new Error('The model returned no persona');
  const traits = Array.isArray(found?.value.traits)
    ? found.value.traits.filter((t): t is string => typeof t === 'string').slice(0, 5)
    : [];
  return { text: persona, traits, at: new Date().toISOString(), items: k.items.length };
}
