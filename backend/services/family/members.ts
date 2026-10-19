/**
 * Adding a person who will play: the one way, for the admin's Players tab,
 * a new circle's first admin and anyone joining through an invite.
 * Their account goes in the circle's users file and the person into every
 * file this circle keeps its people in, so they're never in one and missing
 * from another.
 */
import type { Family } from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { logger } from '../logger';
import { getJson, putJson } from '../s3';
import { invalidateUserConfigCache, type UserConfigData } from '../users';

export interface NewMember {
  id: string;
  name: string;
  /** A household (or version 1 group) to put them in. */
  group?: string;
  color: string;
  passphrase?: string;
  isAdmin?: boolean;
  howWeMet?: string;
}

const PALETTE = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#009688', '#795548'];

/** A color nobody in the circle has yet, while there are some left. */
export function nextColor(users: Record<string, { color?: string }>): string {
  const taken = new Set(Object.values(users).map((u) => u.color));
  return (
    PALETTE.find((c) => !taken.has(c)) ??
    PALETTE[Object.keys(users).length % PALETTE.length] ??
    '#4CAF50'
  );
}

/** An id from a name ("Uncle Sam" → "uncle-sam"), with -2, -3… if it's taken. */
export function idFor(name: string, taken: (id: string) => boolean): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'person';
  let id = base;
  for (let n = 2; taken(id); n++) id = `${base}-${n}`;
  return id;
}

export async function loadUsers(): Promise<UserConfigData> {
  return (
    (await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG)) ?? {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      users: {},
    }
  );
}

// biome-ignore lint/suspicious/noExplicitAny: the version 1 hierarchy is loosely typed where it's read
type Hierarchy = { family?: { people?: Record<string, any>; groups?: Record<string, any> } };

export type AddResult = { ok: true } | { ok: false; error: string };

export async function addMember(m: NewMember): Promise<AddResult> {
  const users = await loadUsers();
  if (users.users[m.id]) return { ok: false, error: `"${m.id}" is already in this circle` };
  users.users[m.id] = {
    group: m.group ?? '',
    color: m.color,
    ...(m.passphrase ? { passphrase: m.passphrase } : {}),
    ...(m.isAdmin ? { isAdmin: true } : {}),
  };
  users.lastUpdated = new Date().toISOString();
  await putJson(S3_PATHS.USERS_CONFIG, users);
  invalidateUserConfigCache();

  // A family may keep both files while it moves to the family file; the
  // person goes in each it has, and a new circle starts its family file.
  const [family, hierarchy] = await Promise.all([
    getJson<Family>(S3_PATHS.FAMILY),
    getJson<Hierarchy>(S3_PATHS.FAMILY_HIERARCHY),
  ]);
  if (hierarchy?.family) await addToHierarchy(hierarchy, m);
  if (family?.version === 2 || !hierarchy?.family) await addToFamily(family, m);
  logger.info('Member added', { userId: m.id });
  return { ok: true };
}

async function addToFamily(family: Family | null, m: NewMember) {
  const f: Family = family ?? { version: 2, name: '', people: {}, ties: [], households: {} };
  f.people[m.id] ??= {
    id: m.id,
    name: m.name,
    participation: 'playing',
    ...(m.howWeMet ? { howWeMet: m.howWeMet } : {}),
  };
  const household = m.group ? f.households[m.group] : undefined;
  if (household && !household.members.includes(m.id)) household.members.push(m.id);
  await putJson(S3_PATHS.FAMILY, f);
}

async function addToHierarchy(hierarchy: Hierarchy, m: NewMember) {
  const fam = hierarchy.family ?? {};
  fam.people ??= {};
  const group = m.group ? fam.groups?.[m.group] : undefined;
  if (group) group.members = [...new Set([...(group.members ?? []), m.id])];
  fam.people[m.id] ??= {
    id: m.id,
    name: m.name,
    groupId: m.group ?? '',
    familySide: group?.familySide ?? '',
  };
  await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);
}
