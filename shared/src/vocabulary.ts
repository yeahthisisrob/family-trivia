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
  },
};

export const wordsFor = (kind: CircleKind = 'family'): Words => WORDS[kind];

/** A relation from relationOf, worded for the circle. */
export const relationWord = (relation: string, kind: CircleKind = 'family'): string =>
  relation === 'family' ? WORDS[kind].together : relation;

/** What someone is to the viewer, as a line: "Your cousin", "In your crew". */
export const yourRelation = (relation: string | null, kind: CircleKind = 'family'): string =>
  relation && relation !== 'family' ? `Your ${relation}` : WORDS[kind].inYours;
