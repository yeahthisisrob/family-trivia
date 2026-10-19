/**
 * Memory links (docs/decisions/0027): a link to someone's Remembering page
 * that anyone can use to add a memory, no account needed. Memories wait for
 * an admin's yes; once let in, they sit with the circle's own.
 */
import type { CircleKind } from './circle';
import type { InviteLifetime, InviteState } from './invite';

export interface MemoryLink {
  token: string;
  circleId: string;
  /** Who it remembers. */
  personId: string;
  createdBy: string;
  createdAt: string;
  /** ISO time; null means until taken back. */
  expiresAt: string | null;
  revokedAt?: string;
  /** Memories added through it so far. */
  uses: number;
}

export type MemoryLinkLifetime = InviteLifetime;

/** A memory from someone outside the circle. */
export interface VisitorMemory {
  id: string;
  name: string;
  /** How they knew them, in their words ("we played in a band in 2009"). */
  how?: string;
  text: string;
  at: string;
  status: 'waiting' | 'shown';
}

/** What the link page shows: the person, and the memories already let in. */
export interface MemoryLinkPreview {
  state: InviteState;
  person?: {
    name: string;
    /** "1984 to 2017" */
    years?: string;
    dedication?: string;
  };
  circle?: { name: string; kind: CircleKind };
  memories?: Pick<VisitorMemory, 'name' | 'how' | 'text' | 'at'>[];
}

export const MEMORY_MAX = 2000;
