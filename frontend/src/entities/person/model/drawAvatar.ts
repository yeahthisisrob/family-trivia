/**
 * Draw a library picture on the device (docs/decisions/0024). Each style is
 * loaded only when first needed, so people on initials download none.
 */
import type { AvatarChoice, AvatarStyle } from '@family-trivia/shared';

// biome-ignore lint/suspicious/noExplicitAny: each DiceBear style module has its own option types
type StyleModule = any;
const STYLES: Record<AvatarStyle, () => Promise<StyleModule>> = {
  lorelei: () => import('@dicebear/lorelei'),
  notionists: () => import('@dicebear/notionists'),
  'open-peeps': () => import('@dicebear/open-peeps'),
  thumbs: () => import('@dicebear/thumbs'),
  'pixel-art': () => import('@dicebear/pixel-art'),
  shapes: () => import('@dicebear/shapes'),
};

const drawn = new Map<string, Promise<string>>();

/** A data URI for the picture; the same choice is drawn once. */
export function drawAvatar(choice: AvatarChoice): Promise<string> {
  const key = `${choice.style}/${choice.seed}`;
  let uri = drawn.get(key);
  if (!uri) {
    uri = Promise.all([import('@dicebear/core'), STYLES[choice.style]()]).then(([core, style]) =>
      core.createAvatar(style, { seed: choice.seed, radius: 50 }).toDataUri(),
    );
    drawn.set(key, uri);
  }
  return uri;
}
