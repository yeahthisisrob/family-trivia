/**
 * A person's picture (docs/decisions/0024). Initials are the default. A
 * person can choose one the AI made for them (from what they love: an
 * animal or a thing, never a face) or one of the bundled animals on a color.
 * AI pictures live in the circle's private media; animals ship with the app.
 */

/** Bundled animals: Microsoft Fluent Emoji (MIT), served from /avatars/animals/{id}.svg. */
export const ANIMALS = [
  'baby_chick',
  'badger',
  'bear',
  'beaver',
  'bison',
  'butterfly',
  'cat_face',
  'cow_face',
  'crab',
  'deer',
  'dodo',
  'dog_face',
  'dolphin',
  'dragon_face',
  'duck',
  'eagle',
  'elephant',
  'flamingo',
  'fox',
  'frog',
  'giraffe',
  'hamster',
  'hatching_chick',
  'hedgehog',
  'hippopotamus',
  'honeybee',
  'horse_face',
  'kangaroo',
  'koala',
  'lady_beetle',
  'lion',
  'lizard',
  'llama',
  'monkey_face',
  'mouse_face',
  'octopus',
  'orangutan',
  'otter',
  'owl',
  'panda',
  'parrot',
  'peacock',
  'penguin',
  'pig_face',
  'polar_bear',
  'rabbit_face',
  'raccoon',
  'seal',
  'shark',
  'sloth',
  'snail',
  'spouting_whale',
  'swan',
  'tiger_face',
  'turtle',
  'unicorn',
  'wolf',
  'zebra',
] as const;
export type Animal = (typeof ANIMALS)[number];

/** Soft colors an animal sits on. */
export const AVATAR_COLORS = {
  sky: '#b6e3f4',
  lilac: '#c0aede',
  periwinkle: '#d1d4f9',
  blush: '#ffd5dc',
  peach: '#ffdfbf',
  mint: '#c1f0d1',
} as const;
export type AvatarColor = keyof typeof AVATAR_COLORS;

export type AvatarChoice =
  | { library: 'ai'; key: string }
  | { library: 'animal'; animal: Animal; color: AvatarColor };

/** An AI picture's key: the person's own folder in the circle's media. */
export const aiAvatarKey = (userId: string, id: string) => `media/avatars/${userId}/${id}.jpg`;
export const isAiAvatarKeyOf = (userId: string, key: string) =>
  new RegExp(`^media/avatars/${userId.replace(/[^a-z0-9_-]/gi, '')}/[a-f0-9-]{36}\\.jpg$`).test(
    key,
  );

export const isAvatarChoice = (v: unknown): v is AvatarChoice => {
  const a = v as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return false;
  if (a.library === 'ai') return typeof a.key === 'string' && a.key.startsWith('media/avatars/');
  return (
    a.library === 'animal' &&
    (ANIMALS as readonly string[]).includes(a.animal as string) &&
    typeof a.color === 'string' &&
    a.color in AVATAR_COLORS
  );
};

export const AVATAR_CREDITS =
  'Animals from Microsoft Fluent Emoji (MIT). Made-for-you pictures are drawn by AI.';

/** How many pictures one person can have made in a day. */
export const AI_PICTURES_PER_DAY = 3;
