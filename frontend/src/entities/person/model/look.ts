/**
 * How a chosen picture shows (docs/decisions/0024): an animal drawing on its
 * color, or a picture made for them from a short-lived private link.
 */
import { AVATAR_COLORS, type AvatarChoice } from '@family-trivia/shared';

export interface Look {
  src: string;
  /** Behind an animal; an AI picture fills the circle. */
  bg?: string;
  /** Animals sit inside the circle with room around them. */
  inset?: boolean;
}

export const animalSrc = (animal: string) => `/avatars/animals/${animal}.svg`;

export function lookOf(choice: AvatarChoice, urls: Record<string, string>): Look | undefined {
  if (choice.library === 'animal')
    return { src: animalSrc(choice.animal), bg: AVATAR_COLORS[choice.color], inset: true };
  const url = urls[choice.key];
  return url ? { src: url } : undefined;
}
