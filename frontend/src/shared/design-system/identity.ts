import { colors } from './tokens/colors';

/** A person's color: stable for their id, the same everywhere in the app. */
export function identityColor(userId: string | null | undefined): string {
  if (!userId) return colors.defaultUser;
  const sum = [...userId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors.user[sum % colors.user.length] ?? colors.defaultUser;
}
