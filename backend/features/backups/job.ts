/**
 * The nightly job (a scheduled Lambda, infra). It does nothing unless the
 * family turned on Settings › Backups › Automatic nightly backups.
 */
import { logger } from '../../services/logger';
import { getSetting } from '../../services/settings';
import { snapshot } from './snapshot';

export async function handler(): Promise<{ ran: boolean; ok?: boolean }> {
  if ((await getSetting('backups.automatic')) !== true) {
    logger.info('Automatic backups are off; nothing to do');
    return { ran: false };
  }
  const run = await snapshot('automatic');
  return { ran: true, ok: run.ok };
}
