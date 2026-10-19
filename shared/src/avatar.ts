/**
 * A person's picture, chosen from one shared library (docs/decisions/0024).
 * Initials are the default; a choice is a style and a seed, drawn on the
 * device from bundled, openly licensed styles. Nothing is uploaded.
 */

export const AVATAR_STYLES = [
  'micah',
  'toon-head',
  'avataaars',
  'big-smile',
  'personas',
  'fun-emoji',
] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const AVATAR_STYLE_LABEL: Record<AvatarStyle, string> = {
  micah: 'Bright',
  'toon-head': 'Toon',
  avataaars: 'Classic',
  'big-smile': 'Big smile',
  personas: 'Personas',
  'fun-emoji': 'Emoji',
};

/** Credit the artists, as their licenses ask (CC BY 4.0; Avataaars is free for any use). */
export const AVATAR_CREDITS =
  'Pictures by Micah Lanier, Johan Melin, Pablo Stanley (Avataaars), Ashley Seo, Draftbit and Davis Uche, drawn with DiceBear.';

/** Natural skin tones, chosen once; the seed varies everything else. */
export const SKIN_TONES = ['light', 'medium', 'tan', 'brown', 'dark'] as const;
export type SkinTone = (typeof SKIN_TONES)[number];

export interface AvatarChoice {
  library: 'dicebear';
  style: AvatarStyle;
  seed: string;
  /** Light when not chosen. Styles without skin (Emoji) ignore it. */
  tone?: SkinTone;
}

export const isAvatarChoice = (v: unknown): v is AvatarChoice => {
  const a = v as AvatarChoice;
  return (
    !!a &&
    a.library === 'dicebear' &&
    (AVATAR_STYLES as readonly string[]).includes(a.style) &&
    typeof a.seed === 'string' &&
    a.seed.length > 0 &&
    a.seed.length <= 64 &&
    (a.tone === undefined || (SKIN_TONES as readonly string[]).includes(a.tone))
  );
};
