/**
 * Invites (docs/decisions/0020): a link a circle's admin shares. Signing in
 * through it joins the circle, as someone new or a person already added.
 */
import type { CircleKind } from './circle';

export type InviteFor = { kind: 'anyone' } | { kind: 'person'; userId: string };

export interface Invite {
  token: string;
  /** The circles it opens; today always one, the admin's. */
  circleIds: string[];
  for: InviteFor;
  createdBy: string;
  createdAt: string;
  /** ISO time; null means until taken back. */
  expiresAt: string | null;
  /** null means any number. */
  maxUses: number | null;
  uses: number;
  /** Joins wait for an admin's yes. */
  approval: boolean;
  revokedAt?: string;
}

/** How long a new link lasts, as offered when making one. */
export const INVITE_LIFETIMES = { day: 1, week: 7, month: 30, forever: null } as const;
export type InviteLifetime = keyof typeof INVITE_LIFETIMES;

export type InviteState = 'open' | 'expired' | 'used-up' | 'revoked';

export function inviteState(invite: Invite, now = new Date()): InviteState {
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt && new Date(invite.expiresAt) <= now) return 'expired';
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return 'used-up';
  return 'open';
}

/** What someone opening a link sees before signing in: only its own circle. */
export interface InvitePreview {
  state: InviteState;
  circle?: { name: string; kind: CircleKind };
  /** Set when the link is for one person the admin already added. */
  forName?: string;
  approval?: boolean;
}

/** What a new person tells the circle about themselves. */
export interface JoinDetails {
  name: string;
  /** Friends circles: how they know the circle ("college roommates"). */
  howWeMet?: string;
}

/** A join waiting for an admin's yes. */
export interface PendingJoin {
  id: string;
  token: string;
  email: string;
  details: JoinDetails;
  requestedAt: string;
}
