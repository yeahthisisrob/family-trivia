/**
 * The words a circle uses for itself (docs/decisions/0021). One model
 * underneath; a family has households, friends have crews. Screens ask for
 * a word here instead of checking the circle's kind.
 */

import type { CircleKind } from './circle';

export interface Words {
  /** The circle as a whole: "the family", "the crew", "the circle". */
  circle: string;
  /** One person in it. */
  member: string;
  /** A group inside the circle. */
  group: string;
  groups: string;
  /** What a group is, in a line. */
  groupHint: string;
  /** What relationOf's "same group" means here. */
  together: string;
  /** Heading over connections worked out from the direct ones. */
  derived: string;
  /** Someone in the circle with no named tie to the viewer. */
  inYours: string;
  /** The same, as a short label beside a name. */
  someone: string;
  /** Names a person might go by here, as an example. */
  nameExamples: string;
  /** The download of everything the circle has made. */
  archive: string;
  /** The circle as a bare noun, for "our ...", "this ...'s", "... reunions". */
  noun: string;
  /** The circle as a one word label: a tag over a name, a heading. */
  title: string;
  /** "the family's": what belongs to the circle. */
  whose: string;
  /** The people and the ties between them, as a view's name. */
  ties: string;
  /** The page that lays out every group and who is in it. */
  tree: string;
  /** What that page shows, in a line. */
  treeHint: string;
  /** A group, said short, for a count ("2 homes"); plural adds an s. */
  unit: string;
}

const WORDS: Record<CircleKind, Words> = {
  family: {
    circle: 'the family',
    member: 'family member',
    group: 'household',
    groups: 'Households',
    groupHint:
      'Homes or branches of the family. Someone can be in more than one, like a child with two homes.',
    together: 'family',
    derived: 'Also in the family',
    inYours: 'In your family',
    someone: 'family',
    nameExamples: 'Grandma Jo, Uncle Sam, Alice',
    archive: 'the family archive',
    noun: 'family',
    title: 'Family',
    whose: "the family's",
    ties: 'Family ties',
    tree: 'The family tree',
    treeHint: 'Every side, every home',
    unit: 'home',
  },
  friends: {
    circle: 'the crew',
    member: 'friend',
    group: 'crew',
    groups: 'Crews',
    groupHint:
      'The groups inside the circle: the college crew, the old team, the neighbors. Someone can be in several.',
    together: 'same crew',
    derived: 'Also connected',
    inYours: 'In your crew',
    someone: 'friend',
    nameExamples: 'Big Mike, Al, Coach',
    archive: "the crew's archive",
    noun: 'crew',
    title: 'Friends',
    whose: "the crew's",
    ties: 'Friendships',
    tree: "Who's who",
    treeHint: 'Every crew, everyone in it',
    unit: 'crew',
  },
  mixed: {
    circle: 'the circle',
    member: 'person',
    group: 'group',
    groups: 'Groups',
    groupHint:
      'Households, crews, anything that belongs together. Someone can be in more than one.',
    together: 'same group',
    derived: 'Also connected',
    inYours: 'In your circle',
    someone: 'in the circle',
    nameExamples: 'Grandma Jo, Big Mike, Alice',
    archive: "the circle's archive",
    noun: 'group',
    title: 'Us',
    whose: "the circle's",
    ties: 'Connections',
    tree: "Who's who",
    treeHint: 'Every group, everyone in it',
    unit: 'group',
  },
};

export const wordsFor = (kind: CircleKind = 'family'): Words => WORDS[kind];

/** A word at the start of a line: "the family's" → "The family's". */
export const capitalized = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** A relation from relationOf, worded for the circle. */
export const relationWord = (relation: string, kind: CircleKind = 'family'): string =>
  relation === 'family' ? WORDS[kind].together : relation;

/** What someone is to the viewer, as a line: "Your cousin", "In your crew". */
export const yourRelation = (relation: string | null, kind: CircleKind = 'family'): string =>
  relation && relation !== 'family' ? `Your ${relation}` : WORDS[kind].inYours;

// ── For the AI (docs/decisions/0023) ─────────────────────────────────────

/** How every prompt names the people it writes for. One frame per kind; prompts never fork. */
export interface AiFrame {
  kind: CircleKind;
  /** "a family", "a circle of close friends". */
  audience: string;
  /** One of them: "family member", "friend". */
  member: string;
  members: string;
  /** The group as a whole, in a sentence: "the family", "the friends". */
  group: string;
  /** Possessive for "their own ...": "family", "friend group". */
  own: string;
  /** What to steer away from, beyond the usual. */
  avoid: string;
  /** Themes that belong to this kind of circle. */
  themes: string;
}

const AI: Record<CircleKind, AiFrame> = {
  family: {
    kind: 'family',
    audience: 'a family',
    member: 'family member',
    members: 'family members',
    group: 'the family',
    own: 'family',
    avoid: 'Never say "our family".',
    themes: 'family traditions, holidays, growing up, the people they come from',
  },
  friends: {
    kind: 'friends',
    audience: 'a circle of close friends',
    member: 'friend',
    members: 'friends',
    group: 'the friends',
    own: 'friend group',
    avoid:
      'They are friends, not family: no family framing (no parents, relatives, "our family" or family trees), and never "our group".',
    themes:
      'how they met, nights out and trips together, inside jokes, music and shows they share, where life has taken each of them',
  },
  mixed: {
    kind: 'mixed',
    audience: 'family and the close friends who are family to them',
    member: 'person in the circle',
    members: 'people in the circle',
    group: 'everyone in the circle',
    own: 'circle',
    avoid:
      'Some are family and some are friends: never assume anyone is related, and never say "our family".',
    themes: 'traditions, shared memories, how they know each other, what each loves',
  },
};

export const aiFrameFor = (kind: CircleKind = 'family'): AiFrame => AI[kind];
