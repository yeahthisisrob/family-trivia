/**
 * The family archive: download everyone's memories (or chosen people's) as a
 * clean zip, one folder per person. The zip is written to the family's own
 * bucket under exports/ and handed back as a short-lived download link.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { requireAdmin } from '../../services/adminAuth';
import { loadJoined } from '../../services/family/joined';
import { loadFamily } from '../../services/family/roster';
import { logger } from '../../services/logger';
import { downloadUrl } from '../../services/media';
import { putBytes } from '../../services/s3';
import { buildArchive } from './build';
import { collectPerson, loadShared } from './collect';
import { canExport, readPermissions, writePermissions } from './permissions';

/** GET /archive/options: may I export, and whom can I choose. */
export async function archiveOptions(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const { visible: family } = await loadJoined();
  return successResponse({
    canExport: await canExport(userId),
    people: Object.values(family.people)
      .map((p) => ({ id: p.id, name: p.name, remembered: !!p.memorial }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    households: Object.values(family.households).map((h) => ({
      id: h.id,
      name: h.name,
      members: h.members,
    })),
  });
}

/** POST /archive/export { people: string[] | "all" } */
export async function exportArchive(
  e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  if (!(await canExport(userId)))
    return errorResponse('Exporting is turned off for you. Ask an admin.', 403);
  const { people: wanted } = JSON.parse(e.body || '{}') as { people?: unknown };
  const family = await loadFamily();
  const all = Object.values(family.people);
  const ids =
    wanted === 'all'
      ? all.map((p) => p.id)
      : Array.isArray(wanted)
        ? wanted.filter((x): x is string => typeof x === 'string' && x in family.people)
        : [];
  if (!ids.length) return errorResponse('Choose at least one person', 400);

  const shared = await loadShared();
  const archives = new Map(
    await Promise.all(ids.map(async (id) => [id, await collectPerson(id, shared)] as const)),
  );
  const now = new Date();
  const zip = buildArchive({
    family,
    people: all.filter((p) => ids.includes(p.id)),
    archives,
    requestedBy: family.people[userId]?.name ?? userId,
    now,
  });
  const key = `exports/${userId}/${now.toISOString().replace(/[:.]/g, '-')}.zip`;
  await putBytes(key, zip, 'application/zip');
  logger.info('Family archive exported', { by: userId, people: ids.length, bytes: zip.length });
  const filename = `${family.name.replace(/[^\w -]+/g, '').trim() || 'family'} archive ${now.toISOString().slice(0, 10)}.zip`;
  return successResponse({
    url: await downloadUrl(key, filename),
    bytes: zip.length,
    people: ids.length,
  });
}

/** GET/PUT /admin/archive/permissions */
export async function getExportPermissions(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  return successResponse(await readPermissions());
}

export async function saveExportPermissions(
  e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  const body = JSON.parse(e.body || '{}') as { everyone?: unknown; users?: unknown };
  if (typeof body.everyone !== 'boolean')
    return errorResponse('everyone must be true or false', 400);
  const users =
    body.users && typeof body.users === 'object'
      ? Object.fromEntries(
          Object.entries(body.users).filter(
            (kv): kv is [string, boolean] => typeof kv[1] === 'boolean',
          ),
        )
      : {};
  await writePermissions({ everyone: body.everyone, users });
  return successResponse({ everyone: body.everyone, users });
}
