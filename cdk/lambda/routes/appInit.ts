// File: lambda/routes/appInit.ts
// Purpose: Consolidated app initialization — split into critical + deferred.
// /app-init returns config/hierarchy/season/activation (fast, ~4 S3 reads).
// /app-init-deferred returns timeline/catchup/games/feud (heavier, loaded in background).

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';
import { getSeasonStatusResponse } from '../services/seasonService';
import { UserConfigData, getUsersInGroup } from '../services/users';
import { loadTimeline, HierarchyPerson } from '../services/timelineService';
import { calculateCatchupStatus, checkPlayEligibility } from '../services/playerStateService';
import { canPlayGameModeAny } from '../services/gameModeService';

// Hierarchy types
interface HierarchyData {
  family: {
    people: Record<string, HierarchyPerson>;
    groups: Record<string, { name: string; description?: string; [key: string]: any }>;
    sides?: Record<string, { name: string; color: string; [key: string]: any }>;
    root?: { partners?: Array<{ id: string }> };
    [key: string]: any;
  };
  [key: string]: any;
}

interface GroupDescriptionData {
  description: string;
  lastUpdated: string;
  updatedBy?: string;
}

// ─── Shared helpers ──────────────────────────────────────────────────

function validateHierarchy(rawHierarchy: HierarchyData | null): HierarchyData | null {
  if (!rawHierarchy) return null;
  return {
    ...rawHierarchy,
    family: {
      ...rawHierarchy.family,
      people: rawHierarchy.family?.people || {},
      groups: rawHierarchy.family?.groups || {},
      sides: rawHierarchy.family?.sides || {},
    },
  };
}

async function loadMemberActivation(
  groupsArray: string[],
): Promise<Array<{ groupId: string; members: Array<{ userId: string; activated: boolean }> }>> {
  let activationCache = await getJson<Record<string, boolean>>(S3_PATHS.MEMBER_ACTIVATION);

  if (activationCache) {
    return Promise.all(
      groupsArray.map(async groupId => {
        try {
          const members = await getUsersInGroup(groupId);
          if (!members || members.length === 0) {
            return { groupId, members: [] as Array<{ userId: string; activated: boolean }> };
          }
          return {
            groupId,
            members: members.map(memberId => ({
              userId: memberId,
              activated: !!activationCache![memberId],
            })),
          };
        } catch (err) {
          logger.error('Error fetching members for group', {
            groupId, error: err instanceof Error ? err.message : String(err),
          });
          return { groupId, members: [] as Array<{ userId: string; activated: boolean }> };
        }
      })
    );
  }

  // Migration fallback: cache doesn't exist yet — build from individual histories
  logger.info('Member activation cache not found, building from history files');
  activationCache = {};
  const results = await Promise.all(
    groupsArray.map(async groupId => {
      try {
        const members = await getUsersInGroup(groupId);
        if (!members || members.length === 0) {
          return { groupId, members: [] as Array<{ userId: string; activated: boolean }> };
        }
        const memberStatuses = await Promise.all(
          members.map(async memberId => {
            try {
              const history = await getJson<any[]>(`answers/history/${memberId}.json`);
              const activated = Array.isArray(history) && history.length > 0;
              if (activated) activationCache![memberId] = true;
              return { userId: memberId, activated };
            } catch {
              return { userId: memberId, activated: false };
            }
          })
        );
        return { groupId, members: memberStatuses };
      } catch (err) {
        logger.error('Error fetching members for group', {
          groupId, error: err instanceof Error ? err.message : String(err),
        });
        return { groupId, members: [] as Array<{ userId: string; activated: boolean }> };
      }
    })
  );

  await putJson(S3_PATHS.MEMBER_ACTIVATION, activationCache).catch(err =>
    logger.warn('Failed to persist member activation cache', { error: String(err) })
  );

  return results;
}

// ─── Critical init: config + hierarchy + season + activation ─────────

export async function appInit(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.queryStringParameters?.userId || null;
    const start = Date.now();

    // All critical config in parallel (~4 S3 reads, all TTL-cached)
    const [userConfig, rawHierarchy, seasonStatus, groupDescriptions, categoriesData, userCategoriesData] = await Promise.all([
      getJson<UserConfigData>(S3_PATHS.USERS_CONFIG),
      getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY),
      getSeasonStatusResponse(),
      getJson<Record<string, GroupDescriptionData>>(S3_PATHS.GROUP_DESCRIPTIONS),
      getJson<any[]>(S3_PATHS.CATEGORIES).catch(() => null),
      userId ? getJson<any[]>(`categories/${userId}/categories.json`).catch(() => null) : Promise.resolve(null),
    ]);

    const hierarchy = validateHierarchy(rawHierarchy);

    // Member activation (1 S3 read from cached file)
    const groupIds = hierarchy?.family?.groups ? Object.keys(hierarchy.family.groups) : [];
    const activationResults = await loadMemberActivation(groupIds);

    const memberActivation: Record<string, Array<{ userId: string; activated: boolean }>> = {};
    activationResults.forEach(({ groupId, members }) => {
      memberActivation[groupId] = members;
    });

    // Question availability — delegates to the single eligibility gate
    const questionAvailability = userId ? await (async () => {
      try {
        const eligibility = await checkPlayEligibility(userId, 'regular');
        return {
          canAnswer: eligibility.canPlay,
          isEndOfSeason: eligibility.reason === 'end_of_season' || undefined,
          nextQuestionAt: eligibility.nextAvailableAt || (eligibility.canPlay ? new Date().toISOString() : null),
          todayET: eligibility.todayET,
          lastQuestionAt: eligibility.lastAnsweredAt,
          catchupAvailable: eligibility.catchupAvailable,
        };
      } catch { return null; }
    })() : null;

    const isFirstRun = !userConfig?.users || Object.keys(userConfig.users).length === 0;

    logger.info('app-init (critical) done', { durationMs: Date.now() - start, userId: userId || 'none' });

    return successResponse({
      isFirstRun,
      userConfig: userConfig || null,
      hierarchy: hierarchy
        ? {
            hierarchy,
            groupDescriptions: Object.entries(hierarchy.family?.groups || {})
              .filter(([, g]) => g.description)
              .reduce((acc, [id, g]) => ({ ...acc, [id]: g.description }), {} as Record<string, string | undefined>),
            familySides: hierarchy.family?.sides || {},
            success: true,
          }
        : null,
      seasonStatus,
      memberActivation,
      groupDescriptions: groupDescriptions || {},
      questionAvailability,
      categories: categoriesData || [],
      userCategories: userCategoriesData || [],
    });
  } catch (err) {
    logger.error('Error in appInit', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse('Failed to initialize app data', 500, err instanceof Error ? err.message : String(err));
  }
}

// ─── Deferred init: timeline + catchup + games + feud ────────────────

export async function appInitDeferred(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.queryStringParameters?.userId || null;
    const side = event.queryStringParameters?.side || 'all';
    const start = Date.now();

    if (!userId) {
      return successResponse({});
    }

    // Load hierarchy for people/sides filtering (TTL-cached, no extra S3 read)
    const rawHierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
    const hierarchy = validateHierarchy(rawHierarchy);
    const people = hierarchy?.family?.people || {};
    const allUserIds = Object.keys(people);

    // Filter users by side
    let timelineUserIds = allUserIds;
    if (side !== 'all' && hierarchy) {
      const rootPartnerIds = hierarchy.family.root?.partners?.map(p => p.id) || [];
      timelineUserIds = allUserIds.filter(uid => {
        if (rootPartnerIds.includes(uid)) return true;
        return people[uid]?.familySide === side;
      });
    }

    // All deferred data in parallel
    const [
      timelineResult, catchupResult,
      casinoRushSession, slotMachineSession,
      casinoRushStatus, slotMachineStatus, curlingStatus,
      feudCurrentRound, feudRotation,
    ] = await Promise.all([
      loadTimeline(people, timelineUserIds, { limit: 20, side }),
      calculateCatchupStatus(userId),

      // Game sessions
      getJson<any>(`casino-rush/${userId}/current-session.json`).catch(() => null),
      getJson<any>(`slot-machine/${userId}/session.json`).catch(() => null),

      // Game mode eligibility
      canPlayGameModeAny(userId, 'casino-rush').catch(() => null),
      canPlayGameModeAny(userId, 'slot-machine').catch(() => null),
      canPlayGameModeAny(userId, 'curling').catch(() => null),

      // Family Feud
      getJson<any>('family-feud/current-round.json').catch(() => null),
      getJson<any>('family-feud/rotation.json').catch(() => null),
    ]);

    logger.info('app-init-deferred done', { durationMs: Date.now() - start, userId });

    return successResponse({
      // Timeline
      ...(timelineResult && {
        timelineData: { facts: timelineResult.facts, trivia: timelineResult.trivia },
        timelinePagination: timelineResult.pagination,
        familySides: hierarchy?.family?.sides || {},
      }),
      // Catchup
      ...(catchupResult && { catchupStatus: catchupResult }),

      // Game statuses
      gameStatuses: {
        casinoRush: {
          canPlay: (casinoRushStatus?.canPlay ?? true)
            && (!casinoRushSession?.status || casinoRushSession.status !== 'active'),
          hasActiveSession: casinoRushSession?.status === 'active',
          nextAvailable: casinoRushStatus?.nextAvailable?.toISOString() ?? null,
        },
        slotMachine: {
          canPlay: slotMachineStatus?.canPlay ?? true,
          hasActiveSession: slotMachineSession?.status === 'active',
          nextAvailable: slotMachineStatus?.nextAvailable?.toISOString() ?? null,
        },
        curling: {
          canPlay: curlingStatus?.canPlay ?? true,
          nextAvailable: curlingStatus?.nextAvailable?.toISOString() ?? null,
        },
      },

      // Family Feud
      familyFeud: (() => {
        const currentIdx = feudRotation?.currentIndex ?? 0;
        const allIds = feudRotation?.allUserIds || allUserIds;
        const nextTargetId = allIds[currentIdx] || allIds[0];
        return {
          currentRound: feudCurrentRound ? {
            roundId: feudCurrentRound.roundId,
            targetUserId: feudCurrentRound.targetUserId,
            targetUserName: feudCurrentRound.targetUserName,
            question: feudCurrentRound.question,
            status: feudCurrentRound.status,
            startedAt: feudCurrentRound.startedAt,
            expiresAt: feudCurrentRound.expiresAt,
            guessCount: Object.keys(feudCurrentRound.guesses || {}).length,
            guessers: Object.values(feudCurrentRound.guesses || {}).map((g: any) => ({
              userName: g.userName, submittedAt: g.submittedAt,
            })),
            myGuess: userId ? feudCurrentRound.guesses?.[userId]?.guess || null : null,
            choices: feudCurrentRound.status === 'active' || feudCurrentRound.status === 'completed' ? feudCurrentRound.choices : null,
            realAnswer: feudCurrentRound.status === 'completed' ? feudCurrentRound.realAnswer : null,
            allGuesses: feudCurrentRound.status === 'completed'
              ? Object.values(feudCurrentRound.guesses || {}).map((g: any) => ({
                  userName: g.userName, guess: g.guess,
                  correct: feudCurrentRound.realAnswer?.toLowerCase().trim() === g.guess?.toLowerCase().trim(),
                }))
              : null,
            results: feudCurrentRound.status === 'completed' ? feudCurrentRound.results : null,
          } : null,
          isMyTurn: nextTargetId === userId && !feudCurrentRound,
          nextTargetUserId: nextTargetId,
          nextTargetUserName: people[nextTargetId]?.name || nextTargetId,
          timesAsTarget: (feudRotation?.roundHistory || []).filter(
            (r: any) => r.userId === userId && !r.passed
          ).length,
        };
      })(),
    });
  } catch (err) {
    logger.error('Error in appInitDeferred', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse('Failed to load deferred data', 500, err instanceof Error ? err.message : String(err));
  }
}
