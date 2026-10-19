/**
 * Turn collected memories into a zip a family can open anywhere: one folder
 * per person with readable Markdown and CSV next to the raw JSON, plus a
 * README saying what's inside.
 */
import { type Family, type FamilyPerson, tieEnds } from '@family-trivia/shared';
import { strToU8, zipSync } from 'fflate';
import type { PersonArchive } from './collect';

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'person';

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: string[], rows: unknown[][]) =>
  `${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : '');

function profile(p: FamilyPerson): string {
  const lines = [`# ${p.name}`, ''];
  if (p.fullName) lines.push(p.fullName, '');
  if (p.born?.date || p.born?.place)
    lines.push(`Born ${[p.born.date, p.born.place].filter(Boolean).join(', ')}`);
  if (p.memorial) {
    lines.push(`In memory${p.memorial.died ? `, ${p.memorial.died}` : ''}`);
    if (p.memorial.dedication) lines.push('', `> ${p.memorial.dedication}`);
  }
  return `${lines.join('\n')}\n`;
}

function factsMarkdown(p: FamilyPerson, a: PersonArchive): string {
  const out = [`# ${p.name}: in their own words`, ''];
  for (const f of [...a.facts].sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''))) {
    out.push(
      `**${f.question ?? ''}**`,
      '',
      `${f.answer}`,
      '',
      `_${f.date ?? day(f.timestamp)}_`,
      '',
    );
  }
  return out.join('\n');
}

function commentsMarkdown(p: FamilyPerson, a: PersonArchive): string {
  const out = [`# ${p.name}: comments`, ''];
  for (const c of a.comments) out.push(`- ${day(c.at)}: ${c.text}`);
  return `${out.join('\n')}\n`;
}

export interface ArchiveRequest {
  family: Family;
  people: FamilyPerson[];
  archives: Map<string, PersonArchive>;
  requestedBy: string;
  now: Date;
}

export function buildArchive({
  family,
  people,
  archives,
  requestedBy,
  now,
}: ArchiveRequest): Uint8Array {
  const root = `${slug(family.name)}-archive-${now.toISOString().slice(0, 10)}`;
  const files: Record<string, Uint8Array> = {};
  const put = (path: string, text: string) => {
    files[`${root}/${path}`] = strToU8(text);
  };
  const used = new Set<string>();

  for (const p of people) {
    const a = archives.get(p.id);
    if (!a) continue;
    let folder = slug(p.name);
    while (used.has(folder)) folder = `${folder}-${p.id}`;
    used.add(folder);
    const dir = `people/${folder}`;
    put(`${dir}/profile.md`, profile(p));
    put(`${dir}/facts.md`, factsMarkdown(p, a));
    put(`${dir}/facts.json`, JSON.stringify(a.facts, null, 2));
    put(
      `${dir}/trivia-answers.csv`,
      csv(
        [
          'date',
          'category',
          'difficulty',
          'question',
          'their answer',
          'correct answer',
          'correct',
          'points',
        ],
        a.trivia.map((t) => [
          day(t.timestamp),
          t.question?.category,
          t.question?.difficulty,
          t.question?.question,
          t.selectedAnswer,
          t.question?.answer,
          t.correct ? 'yes' : 'no',
          t.pointsEarned,
        ]),
      ),
    );
    put(`${dir}/trivia-answers.json`, JSON.stringify(a.trivia, null, 2));
    put(`${dir}/games.json`, JSON.stringify(a.games, null, 2));
    put(`${dir}/comments.md`, commentsMarkdown(p, a));
    put(`${dir}/comments.json`, JSON.stringify(a.comments, null, 2));
    put(`${dir}/reactions.json`, JSON.stringify(a.reactions, null, 2));
    put(`${dir}/family-feud.json`, JSON.stringify(a.feud, null, 2));
  }

  const included = new Set(people.map((p) => p.id));
  put(
    'family.json',
    JSON.stringify(
      {
        name: family.name,
        people: people.map(({ id, name, fullName, born, memorial }) => ({
          id,
          name,
          fullName,
          born,
          memorial,
        })),
        ties: family.ties.filter((t) => tieEnds(t).every((x) => included.has(x))),
      },
      null,
      2,
    ),
  );
  put(
    'README.md',
    [
      `# ${family.name}: family archive`,
      '',
      `Exported ${now.toISOString().slice(0, 10)} by ${requestedBy}. ${people.length} ${people.length === 1 ? 'person' : 'people'}.`,
      '',
      'Each person has a folder in `people/`:',
      '',
      '- `profile.md`: who they are, and how the family remembers them',
      '- `facts.md`: their answers to the daily family questions, in their own words',
      '- `trivia-answers.csv`: every trivia question they answered (opens in any spreadsheet)',
      '- `games.json`, `family-feud.json`: game sessions, scores and Family Feud rounds',
      '- `comments.md`: what they wrote to the family',
      '- `reactions.json`: the reactions they gave, and the ones their answers got',
      '',
      'The `.json` files hold the same data in full, for importing elsewhere.',
      '`family.json` lists the people included and how they are connected.',
      '',
    ].join('\n'),
  );
  return zipSync(files, { level: 6 });
}
