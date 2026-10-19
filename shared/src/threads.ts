/**
 * Threads (docs/decisions/0022): the circle's connections, asked one at a
 * time. "How do you know Bob?" with one tap, at most once a day, and each
 * answer ties a thread between two people. Everyone answers about everyone,
 * so the web builds itself. The answer becomes a tie in the one people model
 * (0021); the admin's editor is only for fixing things.
 */

import type { CircleKind } from './circle';
import type { MetHow, Tie } from './people';
import { MET_LABEL } from './ties';

/** One tap. `me` answers "<other> is my ..." or "we met ...". */
export interface ThreadChoice {
  id: string;
  label: string;
  /** Asks "since about when?" after the tap. */
  asksWhen?: boolean;
}

export interface ThreadQuestion {
  about: { id: string; name: string };
  prompt: string;
  choices: ThreadChoice[];
}

export interface ThreadProgress {
  /** Pairs of people the circle knows how they're connected. */
  tied: number;
  /** Every pair of people in the circle. */
  pairs: number;
}

export interface ThreadsToday {
  /** Null when there's nothing to ask today (answered one, or every thread is tied). */
  question: ThreadQuestion | null;
  progress: ThreadProgress;
}

export interface ThreadAnswer {
  about: string;
  choice: string;
  /** YYYY, when the choice asks for it. */
  when?: string;
}

/** "We haven't met yet": remembered, never asked again, never a tie. */
export const NOT_MET = 'not-met';

const FRIEND_CHOICES: ThreadChoice[] = (Object.keys(MET_LABEL) as MetHow[])
  .filter((how) => how !== 'family' && how !== 'other')
  .map((how) => ({
    id: `met:${how}`,
    label: MET_LABEL[how].charAt(0).toUpperCase() + MET_LABEL[how].slice(1),
    asksWhen: true,
  }));

const FAMILY_CHOICES: ThreadChoice[] = [
  { id: 'partner', label: 'My partner' },
  { id: 'parent', label: 'My parent' },
  { id: 'child', label: 'My child' },
  { id: 'sibling', label: 'My sibling' },
  { id: 'grandparent', label: 'My grandparent' },
  { id: 'grandchild', label: 'My grandchild' },
  { id: 'aunt-uncle', label: 'My aunt or uncle' },
  { id: 'niece-nephew', label: 'My niece or nephew' },
  { id: 'cousin', label: 'My cousin' },
  { id: 'in-law', label: 'An in-law' },
  { id: 'chosen-family', label: 'Chosen family' },
];

const OTHER: ThreadChoice[] = [
  { id: 'met:other', label: 'Another way', asksWhen: true },
  { id: NOT_MET, label: "We haven't met yet" },
];

/** What a circle offers, in order: friends lead with how you met, family with how you're related. */
export function threadChoicesFor(kind: CircleKind): ThreadChoice[] {
  if (kind === 'friends')
    return [...FRIEND_CHOICES, { id: 'family', label: "We're family" }, ...OTHER];
  if (kind === 'family')
    return [...FAMILY_CHOICES, { id: 'met:family', label: 'A friend' }, ...OTHER];
  return [...FAMILY_CHOICES, ...FRIEND_CHOICES, ...OTHER];
}

export const threadPrompt = (kind: CircleKind, name: string): string =>
  kind === 'family' ? `How are you and ${name} related?` : `How do you know ${name}?`;

/**
 * The tie an answer makes, from `me` to `other`. Null for "we haven't met",
 * and for "we're family" (a kinship the admin can name later).
 */
export function tieFromAnswer(me: string, a: ThreadAnswer, id: string): Tie | null {
  const other = a.about;
  const when = a.when && /^\d{4}$/.test(a.when) ? a.when : undefined;
  if (a.choice.startsWith('met:')) {
    const how = a.choice.slice(4) as MetHow;
    if (!(how in MET_LABEL)) return null;
    return { id, type: 'friend', a: me, b: other, met: { how, ...(when ? { when } : {}) } };
  }
  switch (a.choice) {
    case 'partner':
      return { id, type: 'partner', a: me, b: other, kind: 'partnered' };
    case 'parent':
      return { id, type: 'parent', parent: other, child: me, kind: 'birth' };
    case 'child':
      return { id, type: 'parent', parent: me, child: other, kind: 'birth' };
    case 'sibling':
    case 'cousin':
    case 'in-law':
    case 'chosen-family':
      return { id, type: 'kin', a: me, b: other, relation: a.choice };
    // Directional kinship reads "a is the <relation> of b".
    case 'grandparent':
      return { id, type: 'kin', a: other, b: me, relation: 'grandparent' };
    case 'grandchild':
      return { id, type: 'kin', a: me, b: other, relation: 'grandparent' };
    case 'aunt-uncle':
      return { id, type: 'kin', a: other, b: me, relation: 'aunt-uncle' };
    case 'niece-nephew':
      return { id, type: 'kin', a: me, b: other, relation: 'aunt-uncle' };
    default:
      return null;
  }
}
