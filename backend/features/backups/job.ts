/**
 * The nightly job (a scheduled Lambda, infra). It does nothing unless the
 * family turned on Settings › Backups › Automatic nightly backups.
 * A backup copies the whole deployment, every circle, so the setting is the
 * founding circle's: the first in circles.json.
 */
import { listCircles, scopeOf } from '../../services/circles';
import { logger } from '../../services/logger';
import { inCircle } from '../../services/scope';
import { getSetting } from '../../services/settings';
import { snapshot } from './snapshot';

export async function handler(): Promise<{ ran: boolean; ok?: boolean }> {
  const [founding] = await listCircles();
  if (!founding) return { ran: false };
  return inCircle(scopeOf(founding), async () => {
    if ((await getSetting('backups.automatic')) !== true) {
      logger.info('Automatic backups are off; nothing to do');
      return { ran: false };
    }
    const run = await snapshot('automatic');
    return { ran: true, ok: run.ok };
  });
}
