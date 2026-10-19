import type { Look } from '../model/look';

/** An animal sits on its color with room around it; a made picture fills the circle. */
export const lookSx = (look: Look) => ({
  bgcolor: look.bg ?? 'transparent',
  ...(look.inset ? { '& img': { width: '66%', height: '66%', objectFit: 'contain' } } : {}),
});
