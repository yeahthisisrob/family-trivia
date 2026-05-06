/**
 * Convenience re-exports from the auto-generated OpenAPI types.
 * Import from here for cleaner usage:
 *   import type { Question, HistoryEntry } from '@family-trivia/shared/generated';
 */

// Re-export the full generated types for advanced usage (paths, operations)
export type { paths, components, operations } from './api-types';

// ── Schema type aliases ──
// These map directly to components.schemas.* in the OpenAPI spec.

import type { components } from './api-types';

// Core
export type Question = components['schemas']['Question'];
export type DifficultyLevel = components['schemas']['DifficultyLevel'];
export type GenerateMode = components['schemas']['GenerateMode'];
export type ProgressMessage = components['schemas']['ProgressMessage'];
export type HistoryEntry = components['schemas']['HistoryEntry'];
export type FactItem = components['schemas']['FactItem'];

// User & Config
export type UserConfig = components['schemas']['UserConfig'];

// Profile
export type DifficultyStats = components['schemas']['DifficultyStats'];

// Leaderboard
export type LeaderboardEntry = components['schemas']['LeaderboardEntry'];

// Season
export type Season = components['schemas']['Season'];
export type EndOfSeasonStatus = components['schemas']['EndOfSeasonStatus'];

// Categories
export type SystemCategory = components['schemas']['SystemCategory'];
export type CustomCategory = components['schemas']['CustomCategory'];

// Comments
export type FactComment = components['schemas']['FactComment'];
export type TriviaComment = components['schemas']['TriviaComment'];

// Family
export type GroupDescription = components['schemas']['GroupDescription'];

// Celebrations
export type Birthday = components['schemas']['Birthday'];
export type Celebration = components['schemas']['Celebration'];

// Game modes
export type SlotMachineResult = components['schemas']['SlotMachineResult'];
export type CasinoRushSession = components['schemas']['CasinoRushSession'];

// Member Summary
export type BasicQA = components['schemas']['BasicQA'];
export type MemberInsight = components['schemas']['MemberInsight'];
export type MemberSummaryResponse = components['schemas']['MemberSummaryResponse'];
