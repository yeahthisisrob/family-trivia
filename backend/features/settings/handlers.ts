/**
 * Settings: optional features for everyone, and (admins) every setting with
 * where its value comes from, plus the AI picture: which model each task
 * uses, what's available, estimated monthly cost and what was actually used.
 */
import { AI_TASKS, MODEL_CATALOG, type UsageMonth } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, MODELS, successResponse } from '../../config';
import { requireAdmin } from '../../services/adminAuth';
import { loadModelChoices, modelFor } from '../../services/bedrock/core/models';
import { usageKey } from '../../services/bedrock/core/usage';
import { getJson } from '../../services/s3';
import { getAllUsers } from '../../services/users';
import { modelAvailability } from './availability';
import { resolveSettings, saveSettings } from './store';

/** GET /settings/features: which optional parts of the app are on. */
export async function getFeatures(_e: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const settings = await resolveSettings();
  return successResponse(
    Object.fromEntries(
      settings
        .filter((s) => s.section === 'features')
        .map((s) => [s.key.replace('features.', ''), s.value === true]),
    ),
  );
}

async function adminView(refreshAvailability = false) {
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const [settings, availability, players, thisMonth, previous] = await Promise.all([
    resolveSettings(),
    modelAvailability(refreshAvailability),
    getAllUsers().then((u) => u.length),
    getJson<UsageMonth>(usageKey()),
    getJson<UsageMonth>(usageKey(lastMonth)),
  ]);
  await loadModelChoices();
  return {
    settings,
    models: MODEL_CATALOG.map((m) => ({ ...m, availability: availability.models[m.id] ?? null })),
    availabilityCheckedAt: availability.checkedAt,
    tasks: AI_TASKS.map((t) => ({ ...t, model: modelFor(t.id) })),
    defaults: { writer: MODELS.WRITER, fast: MODELS.FAST },
    players,
    usage: { thisMonth: thisMonth ?? {}, lastMonth: previous ?? {} },
  };
}

/** GET /admin/settings (?refreshModels=1 re-checks which models work) */
export async function getAdminSettings(
  e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  return successResponse(await adminView(e.queryStringParameters?.refreshModels === '1'));
}

/** PUT /admin/settings { values: { key: value | null } } */
export async function putAdminSettings(
  e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  const { values } = JSON.parse(e.body || '{}') as { values?: Record<string, unknown> };
  if (!values || typeof values !== 'object') return errorResponse('values is required', 400);
  const problems = await saveSettings(values);
  if (problems.length) return errorResponse('Some settings need fixing', 400, problems.join('\n'));
  return successResponse(await adminView());
}
