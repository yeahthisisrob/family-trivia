/** How each kind of circle shows itself (docs/decisions/0015). */
import type { CircleKind } from '@family-trivia/shared';
import Diversity1RoundedIcon from '@mui/icons-material/Diversity1Rounded';
import FamilyRestroomRoundedIcon from '@mui/icons-material/FamilyRestroomRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';

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

export const CIRCLE_KINDS: readonly CircleKind[] = ['family', 'friends', 'mixed'];
