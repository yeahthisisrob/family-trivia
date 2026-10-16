/**
 * Who may download the family archive. Admins always can; everyone else can
 * when the family allows it for everyone or for them by name.
 */

import { getJson, putJson } from '../../services/s3';
import { isUserAdmin } from '../../services/users';

const KEY = 'config/permissions.json';

export interface ExportPermissions {
  everyone: boolean;
  users: Record<string, boolean>;
}

export async function readPermissions(): Promise<ExportPermissions> {
  const stored = await getJson<{ export?: Partial<ExportPermissions> }>(KEY);
  return { everyone: stored?.export?.everyone ?? false, users: stored?.export?.users ?? {} };
}

export async function writePermissions(p: ExportPermissions): Promise<void> {
  const stored = (await getJson<Record<string, unknown>>(KEY)) ?? {};
  await putJson(KEY, { ...stored, export: p });
}

export async function canExport(userId: string): Promise<boolean> {
  if (await isUserAdmin(userId)) return true;
  const p = await readPermissions();
  return p.users[userId] ?? p.everyone;
}
