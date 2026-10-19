/**
 * The family roster: the one place that answers "who is in this family" and
 * "who is playing right now". Every feature asks here instead of reading
 * config/users.json, the hierarchy, or S3 listings on its own (0009).
 *
 * Storage: `family/family.json` (version 2) when the family has one. Until
 * then the version 1 `family/hierarchy.json` is read and converted on the fly,
 * so an existing family keeps working with no migration.
 */
import {
  type Family,
  fromLegacyHierarchy,
  isPlaying,
  type LegacyHierarchy,
  toLegacyHierarchy,
} from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { logger } from '../logger';
import { getJson, putJson } from '../s3';

interface PlayerAccounts {
  users?: Record<string, unknown>;
}

/** Load the family. Reads are cached per request by the S3 layer. */
export async function loadFamily(): Promise<Family> {
  const stored = await getJson<Family>(S3_PATHS.FAMILY);
  if (stored?.version === 2) return stored;

  const [legacy, accounts] = await Promise.all([
    getJson<LegacyHierarchy>(S3_PATHS.FAMILY_HIERARCHY),
    getJson<PlayerAccounts>(S3_PATHS.USERS_CONFIG),
  ]);
  logger.debug('Reading the version 1 hierarchy as a family');
  return fromLegacyHierarchy(legacy, Object.keys(accounts?.users ?? {}));
}

/**
 * Save the family, keeping the version it replaces under family/history/
 * (the v2 file, or the v1 hierarchy the first time), so any change can be
 * undone. The one way family.json is written.
 */
export async function storeFamily(family: Family, by: string): Promise<void> {
  const previous =
    (await getJson<unknown>(S3_PATHS.FAMILY)) ??
    (await getJson<unknown>(S3_PATHS.FAMILY_HIERARCHY));
  if (previous) {
    await putJson(
      `family/history/${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      previous,
    );
  }
  await putJson(S3_PATHS.FAMILY, family);
  logger.info('Family saved', {
    by,
    people: Object.keys(family.people).length,
    ties: family.ties.length,
  });
}

/**
 * The version 1 hierarchy the tree, timeline and older screens read. A family
 * that still has its hierarchy file keeps reading it, unchanged; one with only
 * a family file (every new circle) gets it derived from that, so people live
 * in one place.
 */
export async function loadHierarchy<H = LegacyHierarchy>(): Promise<H | null> {
  const stored = await getJson<H>(S3_PATHS.FAMILY_HIERARCHY);
  if (stored) return stored;
  const family = await getJson<Family>(S3_PATHS.FAMILY);
  return family?.version === 2 ? (toLegacyHierarchy(family) as H) : null;
}

/**
 * Whether an account is playing right now. Someone with an account who isn't
 * in the family file yet counts as playing, so a new player is never dropped.
 */
export function accountIsPlaying(family: Family, userId: string): boolean {
  const person = family.people[userId];
  return person ? isPlaying(person) : true;
}
