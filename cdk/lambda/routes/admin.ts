// File: lambda/routes/admin.ts
// Purpose: Admin CRUD handlers for players, groups, family tree, and seasons

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson, listObjects, deleteObject } from '../services/s3';
import { getFactHistory, getAllFactHistories, invalidateFactHistoryCache } from '../services/factHistoryService';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';
import { requireAdmin } from '../services/adminAuth';
import { UserConfigData, invalidateUserConfigCache } from '../services/users';
import { SeasonsConfig, Season } from '../services/seasonService';

// Re-export for invalidation of season cache
import { invalidateSeasonsCache } from '../services/seasonService';

// ── Helpers ──────────────────────────────────────────────────────

function getAdminUserId(event: APIGatewayProxyEvent): string | undefined {
  // Check query params first, then body
  const fromQuery = event.queryStringParameters?.adminUserId;
  if (fromQuery) return fromQuery;

  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      return body.adminUserId;
    } catch {
      // ignore
    }
  }
  return undefined;
}

async function checkAdmin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult | null> {
  const adminUserId = getAdminUserId(event);
  const error = await requireAdmin(adminUserId);
  if (error) {
    return errorResponse(error, 403);
  }
  return null;
}

// ── Player Management ────────────────────────────────────────────

export async function getPlayers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const config = await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);
  if (!config) {
    return errorResponse('User config not found', 404);
  }

  const players = Object.entries(config.users).map(([userId, data]) => ({
    userId,
    ...data,
  }));

  return successResponse({ players, success: true });
}

export async function addPlayer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { userId, group, color, passphrase, isAdmin: isAdminFlag } = body;

  if (!userId || !group || !color) {
    return errorResponse('userId, group, and color are required', 400);
  }

  const config = await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);
  if (!config) {
    return errorResponse('User config not found', 404);
  }

  if (config.users[userId]) {
    return errorResponse(`Player "${userId}" already exists`, 409);
  }

  config.users[userId] = {
    group,
    color,
    ...(passphrase && { passphrase }),
    ...(isAdminFlag && { isAdmin: true }),
  };
  config.lastUpdated = new Date().toISOString();

  await putJson(S3_PATHS.USERS_CONFIG, config);
  invalidateUserConfigCache();

  // Sync hierarchy: add player to group's members list AND people object
  if (group) {
    const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
    if (hierarchy?.family) {
      let changed = false;

      // Add to group members
      if (hierarchy.family.groups?.[group]) {
        const members = hierarchy.family.groups[group].members || [];
        if (!members.includes(userId)) {
          members.push(userId);
          hierarchy.family.groups[group].members = members;
          changed = true;
        }
      }

      // Add to people
      if (!hierarchy.family.people[userId]) {
        // Derive display name from userId: "uncle-buddy" → "Uncle Buddy"
        const displayName = userId.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        // Determine familySide from the group's side
        const groupData = hierarchy.family.groups?.[group];
        const familySide = groupData?.familySide || '';
        hierarchy.family.people[userId] = { id: userId, name: displayName, groupId: group, familySide };
        changed = true;
      }

      if (changed) {
        await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);
      }
    }
  }

  logger.info('Admin: player added', { userId });
  return successResponse({ success: true });
}

export async function updatePlayer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { userId, group, color, passphrase, isAdmin: isAdminFlag } = body;

  if (!userId) {
    return errorResponse('userId is required', 400);
  }

  const config = await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);
  if (!config) return errorResponse('User config not found', 404);

  if (!config.users[userId]) {
    return errorResponse(`Player "${userId}" not found`, 404);
  }

  const oldGroup = config.users[userId].group;
  if (group !== undefined) config.users[userId].group = group;
  if (color !== undefined) config.users[userId].color = color;
  if (passphrase !== undefined) (config.users[userId] as any).passphrase = passphrase;
  if (isAdminFlag !== undefined) (config.users[userId] as any).isAdmin = isAdminFlag;
  config.lastUpdated = new Date().toISOString();

  await putJson(S3_PATHS.USERS_CONFIG, config);
  invalidateUserConfigCache();

  // Sync hierarchy group members when group changes
  if (group !== undefined && group !== oldGroup) {
    const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
    if (hierarchy?.family?.groups) {
      // Remove from old group
      if (oldGroup && hierarchy.family.groups[oldGroup]) {
        hierarchy.family.groups[oldGroup].members = (hierarchy.family.groups[oldGroup].members || [])
          .filter((m: string) => m !== userId);
      }
      // Add to new group
      if (group && hierarchy.family.groups[group]) {
        const members = hierarchy.family.groups[group].members || [];
        if (!members.includes(userId)) {
          members.push(userId);
          hierarchy.family.groups[group].members = members;
        }
      }
      await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);
    }
  }

  logger.info('Admin: player updated', { userId });
  return successResponse({ success: true });
}

export async function deletePlayer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { userId } = body;

  if (!userId) {
    return errorResponse('userId is required', 400);
  }

  const config = await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);
  if (!config) return errorResponse('User config not found', 404);

  if (!config.users[userId]) {
    return errorResponse(`Player "${userId}" not found`, 404);
  }

  const oldGroup = config.users[userId].group;
  delete config.users[userId];
  config.lastUpdated = new Date().toISOString();

  await putJson(S3_PATHS.USERS_CONFIG, config);
  invalidateUserConfigCache();

  // Sync hierarchy: remove player from group's members list
  if (oldGroup) {
    const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
    if (hierarchy?.family?.groups?.[oldGroup]) {
      hierarchy.family.groups[oldGroup].members = (hierarchy.family.groups[oldGroup].members || [])
        .filter((m: string) => m !== userId);
      await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);
    }
  }

  logger.info('Admin: player deleted', { userId });
  return successResponse({ success: true });
}

// ── Group Management ─────────────────────────────────────────────

interface HierarchyData {
  version?: string;
  family: {
    name: string;
    root: { partners: { id: string; name: string; role?: string }[] };
    sides?: Record<string, { id: string; name: string; color: string; groups: string[] }>;
    relationships: any[];
    people: Record<string, any>;
    groups: Record<string, { id: string; name: string; members: string[]; familySide?: string; description?: string }>;
  };
}

interface GroupDescriptions {
  [groupId: string]: { description: string; lastUpdated: string; updatedBy?: string };
}

export async function getGroups(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
  const descriptions = await getJson<GroupDescriptions>(S3_PATHS.GROUP_DESCRIPTIONS) || {};

  const groups = hierarchy?.family?.groups || {};
  const sides = hierarchy?.family?.sides || {};

  // Build side lookup: groupId -> sideId
  const groupSideMap: Record<string, string> = {};
  for (const [sideId, sideData] of Object.entries(sides)) {
    for (const gId of sideData.groups || []) {
      groupSideMap[gId] = sideId;
    }
  }

  const result = Object.entries(groups).map(([groupId, group]) => ({
    groupId,
    name: group.name,
    memberCount: group.members?.length || 0,
    members: group.members || [],
    side: groupSideMap[groupId] || group.familySide || null,
    description: descriptions[groupId]?.description || group.description || null,
  }));

  return successResponse({ groups: result, sides, success: true });
}

export async function addGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { groupId, name, description, side } = body;

  if (!groupId || !name) {
    return errorResponse('groupId and name are required', 400);
  }

  const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
  if (!hierarchy) return errorResponse('Hierarchy data not found', 404);

  if (hierarchy.family.groups[groupId]) {
    return errorResponse(`Group "${groupId}" already exists`, 409);
  }

  hierarchy.family.groups[groupId] = {
    id: groupId,
    name,
    members: [],
    ...(side && { familySide: side }),
    ...(description && { description }),
  };

  // Add to side if specified
  if (side && hierarchy.family.sides?.[side]) {
    if (!hierarchy.family.sides[side].groups.includes(groupId)) {
      hierarchy.family.sides[side].groups.push(groupId);
    }
  }

  await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);

  // Also update group descriptions
  if (description) {
    const descriptions = await getJson<GroupDescriptions>(S3_PATHS.GROUP_DESCRIPTIONS) || {};
    descriptions[groupId] = { description, lastUpdated: new Date().toISOString() };
    await putJson(S3_PATHS.GROUP_DESCRIPTIONS, descriptions);
  }

  logger.info('Admin: group added', { groupId });
  return successResponse({ success: true });
}

export async function updateGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { groupId, name, description, side } = body;

  if (!groupId) {
    return errorResponse('groupId is required', 400);
  }

  const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
  if (!hierarchy) return errorResponse('Hierarchy data not found', 404);

  if (!hierarchy.family.groups[groupId]) {
    return errorResponse(`Group "${groupId}" not found`, 404);
  }

  if (name !== undefined) hierarchy.family.groups[groupId].name = name;
  if (description !== undefined) hierarchy.family.groups[groupId].description = description;

  // Handle side re-assignment
  if (side !== undefined && hierarchy.family.sides) {
    // Remove from all sides first
    for (const sideData of Object.values(hierarchy.family.sides)) {
      sideData.groups = sideData.groups.filter(g => g !== groupId);
    }
    // Add to new side
    if (side && hierarchy.family.sides[side]) {
      hierarchy.family.sides[side].groups.push(groupId);
    }
    hierarchy.family.groups[groupId].familySide = side || undefined;
  }

  await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);

  // Also update group descriptions
  if (description !== undefined) {
    const descriptions = await getJson<GroupDescriptions>(S3_PATHS.GROUP_DESCRIPTIONS) || {};
    descriptions[groupId] = { description, lastUpdated: new Date().toISOString() };
    await putJson(S3_PATHS.GROUP_DESCRIPTIONS, descriptions);
  }

  logger.info('Admin: group updated', { groupId });
  return successResponse({ success: true });
}

export async function deleteGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { groupId } = body;

  if (!groupId) {
    return errorResponse('groupId is required', 400);
  }

  const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
  if (!hierarchy) return errorResponse('Hierarchy data not found', 404);

  const group = hierarchy.family.groups[groupId];
  if (!group) {
    return errorResponse(`Group "${groupId}" not found`, 404);
  }

  if (group.members && group.members.length > 0) {
    return errorResponse('Cannot delete a group that has members. Remove members first.', 400);
  }

  delete hierarchy.family.groups[groupId];

  // Remove from sides
  if (hierarchy.family.sides) {
    for (const sideData of Object.values(hierarchy.family.sides)) {
      sideData.groups = sideData.groups.filter(g => g !== groupId);
    }
  }

  await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);

  logger.info('Admin: group deleted', { groupId });
  return successResponse({ success: true });
}

// ── Family Tree Management ───────────────────────────────────────

export async function getFamilyTree(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
  if (!hierarchy) return errorResponse('Hierarchy data not found', 404);

  return successResponse({
    rootPartners: hierarchy.family.root?.partners || [],
    sides: hierarchy.family.sides || {},
    success: true,
  });
}

export async function updateFamilyTree(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { rootPartners, sides } = body;

  const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
  if (!hierarchy) return errorResponse('Hierarchy data not found', 404);

  if (rootPartners !== undefined) {
    hierarchy.family.root = { ...hierarchy.family.root, partners: rootPartners };
  }

  if (sides !== undefined) {
    hierarchy.family.sides = sides;
  }

  await putJson(S3_PATHS.FAMILY_HIERARCHY, hierarchy);

  logger.info('Admin: family tree updated');
  return successResponse({ success: true });
}

// ── Season Management ────────────────────────────────────────────

export async function getSeasons(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const config = await getJson<SeasonsConfig>(S3_PATHS.SEASONS_CONFIG);

  return successResponse({
    currentSeasonNumber: config?.currentSeasonNumber ?? null,
    seasons: config?.seasons || [],
    success: true,
  });
}

export async function addSeason(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { seasonNumber, name, startDate, endDate, status, message } = body;

  if (!seasonNumber || !name || !startDate) {
    return errorResponse('seasonNumber, name, and startDate are required', 400);
  }

  const config = await getJson<SeasonsConfig>(S3_PATHS.SEASONS_CONFIG) || {
    currentSeasonNumber: null,
    seasons: [],
  };

  if (config.seasons.find(s => s.seasonNumber === seasonNumber)) {
    return errorResponse(`Season ${seasonNumber} already exists`, 409);
  }

  const newSeason: Season = {
    seasonNumber,
    name,
    startDate,
    endDate: endDate || null,
    status: status || 'upcoming',
    message: message || null,
  };

  config.seasons.push(newSeason);
  config.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  // Auto-set currentSeasonNumber when adding an active season
  if (newSeason.status === 'active') {
    config.currentSeasonNumber = seasonNumber;
  }

  await putJson(S3_PATHS.SEASONS_CONFIG, config);
  invalidateSeasonsCache();

  logger.info('Admin: season added', { seasonNumber, setActive: newSeason.status === 'active' });
  return successResponse({ success: true });
}

export async function updateSeason(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { seasonNumber, name, startDate, endDate, status, message, currentSeasonNumber } = body;

  const config = await getJson<SeasonsConfig>(S3_PATHS.SEASONS_CONFIG);
  if (!config) return errorResponse('Seasons config not found', 404);

  // Allow updating currentSeasonNumber at the top level
  if (currentSeasonNumber !== undefined) {
    config.currentSeasonNumber = currentSeasonNumber;
  }

  if (seasonNumber !== undefined) {
    const season = config.seasons.find(s => s.seasonNumber === seasonNumber);
    if (!season) {
      return errorResponse(`Season ${seasonNumber} not found`, 404);
    }

    if (name !== undefined) season.name = name;
    if (startDate !== undefined) season.startDate = startDate;
    if (endDate !== undefined) season.endDate = endDate;
    if (status !== undefined) season.status = status;
    if (message !== undefined) season.message = message;

    // Keep currentSeasonNumber in sync with status changes
    if (status === 'active') {
      config.currentSeasonNumber = seasonNumber;
    } else if (status === 'concluded' && config.currentSeasonNumber === seasonNumber) {
      config.currentSeasonNumber = null;
    }
  }

  await putJson(S3_PATHS.SEASONS_CONFIG, config);
  invalidateSeasonsCache();

  logger.info('Admin: season updated', { seasonNumber });
  return successResponse({ success: true });
}

export async function deleteSeason(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { seasonNumber } = body;

  if (seasonNumber === undefined) {
    return errorResponse('seasonNumber is required', 400);
  }

  const config = await getJson<SeasonsConfig>(S3_PATHS.SEASONS_CONFIG);
  if (!config) return errorResponse('Seasons config not found', 404);

  const idx = config.seasons.findIndex(s => s.seasonNumber === seasonNumber);
  if (idx === -1) {
    return errorResponse(`Season ${seasonNumber} not found`, 404);
  }

  config.seasons.splice(idx, 1);

  // Clear currentSeasonNumber if it was pointing to the deleted season
  if (config.currentSeasonNumber === seasonNumber) {
    config.currentSeasonNumber = null;
  }

  await putJson(S3_PATHS.SEASONS_CONFIG, config);
  invalidateSeasonsCache();

  logger.info('Admin: season deleted', { seasonNumber });
  return successResponse({ success: true });
}

// ── User Facts Management ─────────────────────────────────────────

export async function getUserFacts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return errorResponse('userId is required', 400);
  }

  const entries = await getFactHistory(userId);

  // Return richer info — timestamp is the precise identity, key kept for compat
  const facts = entries.map(e => ({
    timestamp: e.timestamp,
    key: `${e.questionType}_${e.questionIndex ?? ''}_${e.date}`,
    date: e.date,
    question: e.question || null,
    answer: e.answer || null,
    answered: e.answered || false,
    skipped: e.skipped || false,
    questionType: e.questionType,
    questionIndex: e.questionIndex,
  }));

  logger.info('Admin: listed user facts', { userId, count: facts.length });
  return successResponse({ facts, success: true });
}

export async function updateUserFact(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const {
    userId, timestamp,
    // Legacy fallback fields
    factKey, date, questionType,
    // Updatable fields
    answer, question, newQuestionType, newQuestionIndex, newDate,
  } = body;

  if (!userId) {
    return errorResponse('userId is required', 400);
  }

  const entries = await getFactHistory(userId);

  // Prefer exact timestamp match (unique, precise). Fall back to date+type for legacy callers.
  let entry = timestamp ? entries.find(e => e.timestamp === timestamp) : undefined;
  if (!entry) {
    const targetDate = date || factKey?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    const targetType = questionType || (factKey?.startsWith('shared') ? 'shared' : 'basic');
    if (!targetDate) {
      return errorResponse('Could not identify entry — supply timestamp or date+questionType', 400);
    }
    entry = entries.find(e => e.date === targetDate && e.questionType === targetType);
  }
  if (!entry) {
    return errorResponse('Fact not found', 404);
  }

  // Update answer if provided
  if (answer !== undefined) {
    entry.answer = answer;
    entry.fact = answer;
  }
  // Update question text if provided
  if (question !== undefined) {
    entry.question = question;
  }
  // Update question type if provided (fixing misclassified basic ↔ shared)
  if (newQuestionType === 'shared' || newQuestionType === 'basic') {
    entry.questionType = newQuestionType;
    if (newQuestionType === 'shared') {
      delete (entry as any).questionIndex;
    }
  }
  // Update questionIndex (only meaningful for basic)
  if (newQuestionIndex !== undefined && entry.questionType === 'basic') {
    entry.questionIndex = newQuestionIndex;
  }
  // Update date (useful when moving a catchup entry to its correct original date)
  if (newDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    entry.date = newDate;
  }

  await putJson(S3_PATHS.FACT_ANSWER_HISTORY(userId), entries);
  invalidateFactHistoryCache(userId);

  logger.info('Admin: user fact updated in history', { userId, timestamp: entry.timestamp });
  return successResponse({ success: true });
}

export async function deleteUserFact(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { userId, timestamp, factKey, date, questionType } = body;

  if (!userId) {
    return errorResponse('userId is required', 400);
  }

  const entries = await getFactHistory(userId);

  // Prefer timestamp match — deletes EXACTLY ONE entry. This is critical:
  // the legacy date+type path deletes ALL matching entries, which caused
  // accidental data loss when wrong-typed duplicates existed.
  let filtered: typeof entries;
  let removed = 0;
  if (timestamp) {
    filtered = entries.filter(e => e.timestamp !== timestamp);
    removed = entries.length - filtered.length;
  } else {
    const targetDate = date || factKey?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    const targetType = questionType || (factKey?.startsWith('shared') ? 'shared' : 'basic');
    if (!targetDate) {
      return errorResponse('Could not identify entry — supply timestamp or date+questionType', 400);
    }
    filtered = entries.filter(e => !(e.date === targetDate && e.questionType === targetType));
    removed = entries.length - filtered.length;
  }

  if (removed === 0) {
    return errorResponse('Fact entry not found', 404);
  }

  await putJson(S3_PATHS.FACT_ANSWER_HISTORY(userId), filtered);
  invalidateFactHistoryCache(userId);

  logger.info('Admin: user fact deleted from history', { userId, timestamp, removed });
  return successResponse({ success: true, removed });
}

// ── User Trivia History Management ──────────────────────────────

export async function getUserTrivia(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return errorResponse('userId is required', 400);
  }

  // All trivia data (regular + casino rush) lives in answer history
  const historyKey = S3_PATHS.ANSWER_HISTORY(userId);
  const history = (await getJson<any[]>(historyKey)) || [];

  // Sort newest first
  history.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  logger.info('Admin: fetched user trivia history', { userId, count: history.length });
  return successResponse({ history, success: true });
}

export async function deleteUserTrivia(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const denied = await checkAdmin(event);
  if (denied) return denied;

  const body = JSON.parse(event.body || '{}');
  const { userId, timestamps } = body;

  if (!userId || !timestamps || !Array.isArray(timestamps) || timestamps.length === 0) {
    return errorResponse('userId and timestamps (non-empty array) are required', 400);
  }

  // All data lives in answer history — just filter it
  const historyKey = S3_PATHS.ANSWER_HISTORY(userId);
  const history = await getJson<any[]>(historyKey);
  if (!history) {
    return errorResponse('No trivia history found for this user', 404);
  }

  const timestampSet = new Set(timestamps);
  const filtered = history.filter(entry => !timestampSet.has(entry.timestamp));
  const removedCount = history.length - filtered.length;
  await putJson(historyKey, filtered);

  logger.info('Admin: deleted trivia answers', { userId, removedCount, requestedCount: timestamps.length });
  return successResponse({ success: true, removedCount });
}

// ── Game Session Management ─────────────────────────────────────

export async function getGameSessions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const adminId = getAdminUserId(event);
  const authErr = await requireAdmin(adminId);
  if (authErr) return errorResponse(authErr, 403);

  const userId = event.queryStringParameters?.userId;

  // If no userId, scan ALL users for stuck sessions (for the admin overview)
  if (!userId) {
    const stuckSessions: Array<{
      userId: string; type: string; status: string;
      questions: number; answered: number; startTime: string;
    }> = [];

    // Scan all casino-rush current sessions
    const crKeys = await listObjects('casino-rush/');
    const sessionKeys = crKeys.filter(k => k.endsWith('/current-session.json'));
    for (const key of sessionKeys) {
      try {
        const session = await getJson<any>(key);
        if (!session) continue;
        const uid = key.split('/')[1];
        const qCount = session.questions?.length || 0;
        const answered = session.questions?.filter((q: any) => q.answeredAt)?.length || 0;
        stuckSessions.push({
          userId: uid,
          type: 'Casino Rush',
          status: session.status || 'unknown',
          questions: qCount,
          answered,
          startTime: session.startTime ? new Date(session.startTime).toISOString() : 'unknown',
        });
      } catch { /* skip */ }
    }

    // Scan slot machine sessions
    const smKeys = await listObjects('slot-machine/');
    const smSessionKeys = smKeys.filter(k => k.endsWith('/session.json'));
    for (const key of smSessionKeys) {
      try {
        const session = await getJson<any>(key);
        if (!session || session.status === 'completed') continue;
        const uid = key.split('/')[1];
        stuckSessions.push({
          userId: uid,
          type: 'Slot Machine',
          status: session.status || 'unknown',
          questions: 0,
          answered: 0,
          startTime: session.lastPlayedAt ? new Date(session.lastPlayedAt).toISOString() : 'unknown',
        });
      } catch { /* skip */ }
    }

    return successResponse({ sessions: stuckSessions });
  }

  // Per-user detail (existing behavior)
  const sessions: { type: string; status: string; lastPlayed: string | null; details: string }[] = [];

  try {
    const crSession = await getJson<any>(`casino-rush/${userId}/current-session.json`);
    const crHistory = await getJson<any>(`casino-rush/${userId}/history.json`);
    sessions.push({
      type: 'Casino Rush',
      status: crSession?.status || 'none',
      lastPlayed: crHistory?.lastPlayedAt ? new Date(crHistory.lastPlayedAt).toISOString() : null,
      details: crSession ? `Q${(crSession.currentQuestionIndex || 0) + 1}/${crSession.questions?.length || 0}` : 'No session',
    });
  } catch {
    sessions.push({ type: 'Casino Rush', status: 'none', lastPlayed: null, details: 'No session' });
  }

  try {
    const smSession = await getJson<any>(`slot-machine/${userId}/session.json`);
    sessions.push({
      type: 'Slot Machine',
      status: smSession?.status || 'none',
      lastPlayed: smSession?.lastPlayedAt ? new Date(smSession.lastPlayedAt).toISOString() : null,
      details: smSession?.result ? `${smSession.result.multiplier}× ${smSession.result.category}` : 'No session',
    });
  } catch {
    sessions.push({ type: 'Slot Machine', status: 'none', lastPlayed: null, details: 'No session' });
  }

  return successResponse({ sessions });
}

export async function resetGameSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { adminUserId: adminId, userId, gameType } = body;

  const authErr = await requireAdmin(adminId);
  if (authErr) return errorResponse(authErr, 403);

  if (!userId || !gameType) return errorResponse('Missing userId or gameType', 400);

  const deleted: string[] = [];

  if (gameType === 'casino-rush' || gameType === 'all') {
    // Delete current session
    try {
      await deleteObject(`casino-rush/${userId}/current-session.json`);
      deleted.push('casino-rush/current-session');
    } catch { /* doesn't exist */ }

    // Delete history (resets cooldown)
    try {
      await deleteObject(`casino-rush/${userId}/history.json`);
      deleted.push('casino-rush/history');
    } catch { /* doesn't exist */ }
  }

  if (gameType === 'slot-machine' || gameType === 'all') {
    // Delete session (also resets cooldown since lastPlayedAt is in session)
    try {
      await deleteObject(`slot-machine/${userId}/session.json`);
      deleted.push('slot-machine/session');
    } catch { /* doesn't exist */ }

    // Delete stats
    try {
      await deleteObject(`slot-machine/${userId}/stats.json`);
      deleted.push('slot-machine/stats');
    } catch { /* doesn't exist */ }
  }

  logger.info('Admin: reset game sessions', { userId, gameType, deleted });
  return successResponse({ success: true, deleted });
}

// ── Daily Question Management ───────────────────────────────────

export async function getDailyQuestions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const adminId = getAdminUserId(event);
  const authErr = await requireAdmin(adminId);
  if (authErr) return errorResponse(authErr, 403);

  // List recent shared daily questions
  const keys = await listObjects('facts/daily/shared/');
  const questions: any[] = [];

  // Get last 14 days of questions
  const recentKeys = keys.sort().reverse().slice(0, 14);
  for (const key of recentKeys) {
    try {
      const data = await getJson<any>(key);
      const date = key.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1] || '';
      questions.push({
        key,
        date,
        question: data?.question || '',
        createdBy: data?.createdBy || '',
        answered: !!data?.answered,
      });
    } catch { /* skip */ }
  }

  return successResponse({ questions });
}

export async function deleteDailyQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { adminUserId: adminId, date } = body;

  const authErr = await requireAdmin(adminId);
  if (authErr) return errorResponse(authErr, 403);

  if (!date) return errorResponse('Missing date', 400);

  const deleted: string[] = [];

  // 1. Delete the shared question
  try {
    await deleteObject(`facts/daily/shared/${date}.json`);
    deleted.push('shared');
  } catch { /* may not exist */ }

  // 2. Remove this date's entries from all users' consolidated histories
  try {
    const allHistories = await getAllFactHistories();
    let usersUpdated = 0;
    for (const [userId, entries] of allHistories) {
      const filtered = entries.filter(e => !(e.questionType === 'shared' && e.date === date));
      if (filtered.length !== entries.length) {
        await putJson(S3_PATHS.FACT_ANSWER_HISTORY(userId), filtered);
        usersUpdated++;
      }
    }
    deleted.push(`${usersUpdated} user histories updated`);
  } catch (err) {
    logger.warn('Could not clean user histories', { error: err });
  }

  logger.info('Admin: deleted daily question + user history entries', { date, deletedCount: deleted.length });
  return successResponse({ success: true, date, deleted: deleted.length });
}
