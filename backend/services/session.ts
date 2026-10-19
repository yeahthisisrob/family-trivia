/**
 * A signed-in session: the token and the circles it opens. The one place a
 * session is made, for signing in, joining with a passphrase or an invite.
 */
import type { MyCircle } from '@family-trivia/shared';
import { type GoogleUser, signJwt } from './auth';
import { accountIdOf, rebuildMemberships } from './circles';

export interface Session {
  token: string;
  userId: string;
  circleId: string;
  circles: MyCircle[];
  email: string;
  name: string;
  picture?: string;
  isNewLink: boolean;
}

/** The session for a Google sign-in, opening `open` if they're in it. Null when they're in no circle. */
export async function sessionFor(
  google: GoogleUser,
  opts: { open?: string; isNewLink: boolean },
): Promise<Session | null> {
  const circles = await rebuildMemberships(google.email);
  const current = circles.find((c) => c.id === opts.open) ?? circles[0];
  if (!current) return null;
  return {
    token: await signJwt({ sub: accountIdOf(google.email), email: google.email }),
    userId: current.userId,
    circleId: current.id,
    circles,
    email: google.email,
    name: google.name,
    picture: google.picture,
    isNewLink: opts.isNewLink,
  };
}
