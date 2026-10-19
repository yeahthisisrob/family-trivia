/**
 * A person's picture, chosen from one shared library (docs/decisions/0024).
 * Initials are the default; a choice is a style and a seed, drawn on the
 * device from bundled, public-domain styles. Nothing is uploaded.
 */

export const AVATAR_STYLES = [
  'lorelei',
  'notionists',
  'open-peeps',
  'thumbs',
  'pixel-art',
  'shapes',
] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const AVATAR_STYLE_LABEL: Record<AvatarStyle, string> = {
  lorelei: 'Sketch',
  notionists: 'Doodle',
  'open-peeps': 'Peeps',
  thumbs: 'Thumbs',
  'pixel-art': 'Pixel',
  shapes: 'Shapes',
};

export interface AvatarChoice {
  library: 'dicebear';
  style: AvatarStyle;
  seed: string;
}

export const isAvatarChoice = (v: unknown): v is AvatarChoice => {
  const a = v as AvatarChoice;
  return (
    !!a &&
    a.library === 'dicebear' &&
    (AVATAR_STYLES as readonly string[]).includes(a.style) &&
    typeof a.seed === 'string' &&
    a.seed.length > 0 &&
    a.seed.length <= 64
  );
};
