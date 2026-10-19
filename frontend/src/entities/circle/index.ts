/** How each kind of circle shows itself (docs/decisions/0015). */
import { type CircleKind, type Words, wordsFor } from '@family-trivia/shared';
import Diversity1RoundedIcon from '@mui/icons-material/Diversity1Rounded';
import FamilyRestroomRoundedIcon from '@mui/icons-material/FamilyRestroomRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import { currentCircleKind } from '../../session';

export const KIND_ICON: Record<CircleKind, typeof Groups2RoundedIcon> = {
  family: FamilyRestroomRoundedIcon,
  friends: Groups2RoundedIcon,
  mixed: Diversity1RoundedIcon,
};

export const KIND_LABEL: Record<CircleKind, string> = {
  family: 'Family',
  friends: 'Friends',
  mixed: 'Family and friends',
};

/** One line about a circle, for someone who hasn't seen it yet. */
export const KIND_LINE: Record<CircleKind, string> = {
  family: 'A family that plays together',
  friends: 'A circle of friends',
  mixed: 'Family and the friends who are family',
};

export { CIRCLE_KINDS } from '@family-trivia/shared';

/** The kind of circle this screen is in, and its words (docs/decisions/0021). */
export function useCircleWords(override?: CircleKind): { kind: CircleKind; words: Words } {
  const kind = override ?? currentCircleKind();
  return { kind, words: wordsFor(kind) };
}
