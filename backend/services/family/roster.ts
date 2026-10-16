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
} from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { logger } from '../logger';
import { getJson } from '../s3';

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
 * Whether an account is playing right now. Someone with an account who isn't
 * in the family file yet counts as playing, so a new player is never dropped.
 */
export function accountIsPlaying(family: Family, userId: string): boolean {
  const person = family.people[userId];
  return person ? isPlaying(person) : true;
}
