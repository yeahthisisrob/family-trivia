/**
 * `just migrate-rsvps [--apply]`: rewrite every circle's answers to plans in
 * the shape docs/decisions/0036 gives them. A dry run unless --apply; with
 * it, a backup of the whole bucket comes first (0014) and nothing changes
 * if the backup fails. Reads BUCKET_NAME and BACKUP_BUCKET_NAME from the
 * environment (backend/.env.local for a dev bucket).
 */
import { snapshot } from '../features/backups/snapshot';
import { migrateRsvps } from '../features/plans/migrateRsvps';
import { listCircles, scopeOf } from '../services/circles';
import { logger } from '../services/logger';
import { inCircle } from '../services/scope';

const apply = process.argv.includes('--apply');

async function main() {
  if (apply) {
    const [founding] = await listCircles();
    if (!founding) throw new Error('No circles in this bucket');
    const backup = await inCircle(scopeOf(founding), () => snapshot('manual', 'migrate-rsvps'));
    if (!backup.ok) throw new Error(`Backup failed, nothing changed: ${backup.error}`);
    logger.info('Backed up', { prefix: backup.prefix, objects: backup.objects });
  }
  const report = await migrateRsvps(apply);
  logger.info(apply ? 'Migrated answers to plans' : 'Dry run (add --apply to write)', { report });
}

main().catch((err: unknown) => {
  logger.error('migrate-rsvps failed', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});
