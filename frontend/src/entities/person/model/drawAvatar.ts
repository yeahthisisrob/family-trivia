/**
 * Draw a library picture on the device (docs/decisions/0024): friendly faces
 * on soft colors. Each style loads only when first needed, so people on
 * initials download none.
 */
import type { AvatarChoice, AvatarStyle, SkinTone } from '@family-trivia/shared';

// biome-ignore lint/suspicious/noExplicitAny: each DiceBear style module has its own option types
type StyleModule = any;
const STYLES: Record<AvatarStyle, () => Promise<StyleModule>> = {
  micah: () => import('@dicebear/micah'),
  'toon-head': () => import('@dicebear/toon-head'),
  avataaars: () => import('@dicebear/avataaars'),
  'big-smile': () => import('@dicebear/big-smile'),
  personas: () => import('@dicebear/personas'),
  'fun-emoji': () => import('@dicebear/fun-emoji'),
};

/** Each natural tone, as each style draws skin. */
const SKIN: Partial<Record<AvatarStyle, { key: string; tones: Record<SkinTone, string> }>> = {
  micah: {
    key: 'baseColor',
    tones: { light: 'f9c9b6', medium: 'e0ac8e', tan: 'c68e6e', brown: 'ac6651', dark: '77311d' },
  },
  'toon-head': {
    key: 'skinColor',
    tones: { light: 'f1c3a5', medium: 'c68e7a', tan: 'b98e6a', brown: 'a36b4f', dark: '5c3829' },
  },
  avataaars: {
    key: 'skinColor',
    tones: { light: 'ffdbb4', medium: 'edb98a', tan: 'd08b5b', brown: 'ae5d29', dark: '614335' },
  },
  'big-smile': {
    key: 'skinColor',
    tones: { light: 'ffe4c0', medium: 'efcc9f', tan: 'c99c62', brown: '8c5a2b', dark: '643d19' },
  },
  personas: {
    key: 'skinColor',
    tones: { light: 'eeb4a4', medium: 'e5a07e', tan: 'd78774', brown: 'b16a5b', dark: '623d36' },
  },
};

/** The swatch for a tone, for the picker. */
export const toneSwatch = (tone: SkinTone) => `#${SKIN.personas?.tones[tone]}`;

/** Soft backgrounds, the same for every style. */
const BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c1f0d1'];

/** Friendly faces only: every expression a style can draw that smiles or winks. */
const FRIENDLY: Record<AvatarStyle, Record<string, unknown>> = {
  micah: {
    mouth: ['smile', 'laughing', 'smirk'],
    eyes: ['eyes', 'round', 'smiling'],
    eyebrows: ['up', 'eyelashesUp'],
  },
  'toon-head': {
    mouth: ['laugh', 'smile'],
    eyes: ['happy', 'wide', 'wink'],
    eyebrows: ['raised', 'happy', 'neutral'],
  },
  avataaars: {
    mouth: ['smile', 'default', 'twinkle'],
    eyes: ['default', 'happy', 'wink', 'squint'],
    eyebrows: ['default', 'defaultNatural', 'raisedExcited', 'raisedExcitedNatural'],
    accessories: ['kurt', 'prescription01', 'prescription02', 'round', 'sunglasses', 'wayfarers'],
    accessoriesProbability: 15,
    facialHairProbability: 20,
  },
  'big-smile': {
    mouth: ['openedSmile', 'gapSmile', 'teethSmile', 'kawaii'],
    eyes: ['cheery', 'normal', 'winking', 'starstruck'],
    accessories: ['catEars', 'glasses', 'sunglasses', 'mustache'],
    accessoriesProbability: 25,
  },
  personas: {
    mouth: ['smile', 'bigSmile', 'smirk'],
    eyes: ['open', 'happy', 'wink', 'glasses'],
  },
  'fun-emoji': {
    mouth: ['lilSmile', 'cute', 'wideSmile', 'smileTeeth', 'smileLol', 'shy'],
    eyes: ['cute', 'wink', 'wink2', 'plain', 'love', 'stars', 'shades', 'glasses'],
  },
};

const drawn = new Map<string, Promise<string>>();

/** A data URI for the picture; the same choice is drawn once. */
export function drawAvatar(choice: AvatarChoice): Promise<string> {
  const tone = choice.tone ?? 'light';
  const key = `${choice.style}/${choice.seed}/${tone}`;
  const skin = SKIN[choice.style];
  let uri = drawn.get(key);
  if (!uri) {
    uri = Promise.all([import('@dicebear/core'), STYLES[choice.style]()]).then(([core, style]) =>
      core
        .createAvatar(style, {
          seed: choice.seed,
          radius: 50,
          backgroundColor: BACKGROUNDS,
          ...FRIENDLY[choice.style],
          ...(skin ? { [skin.key]: [skin.tones[tone]] } : {}),
        })
        .toDataUri(),
    );
    drawn.set(key, uri);
  }
  return uri;
}
