/**
 * Family settings: defined once here, rendered by the admin Settings page
 * from these definitions, and resolved on the server as saved value, then
 * environment, then default. Each value reports where it came from.
 */
import { AI_TASKS } from './ai';

export type SettingType = 'boolean' | 'model';
export type SettingSource = 'stored' | 'env' | 'default';
export type SettingValue = boolean | string | null;

export interface SettingDefinition {
  key: string;
  section: 'features' | 'ai' | 'backups';
  type: SettingType;
  label: string;
  help: string;
  default: SettingValue;
  /** An environment variable that sets it when nothing is saved. */
  env?: string;
}

export interface ResolvedSetting extends SettingDefinition {
  value: SettingValue;
  source: SettingSource;
}

export const SETTINGS: readonly SettingDefinition[] = [
  {
    key: 'features.photos',
    section: 'features',
    type: 'boolean',
    label: 'Photo albums',
    help: 'Links to shared photo albums (Google Photos and others) in the Family tab.',
    default: true,
  },
  {
    key: 'features.familyFeud',
    section: 'features',
    type: 'boolean',
    label: 'Family Feud',
    help: 'Rounds where everyone guesses how someone in the family answered.',
    default: true,
  },
  {
    key: 'features.arcade',
    section: 'features',
    type: 'boolean',
    label: 'Arcade',
    help: 'Casino games and arcade high scores.',
    default: true,
  },
  {
    key: 'backups.automatic',
    section: 'backups',
    type: 'boolean',
    label: 'Automatic nightly backups',
    help: 'A full copy of the family’s answers, facts, photos and games every night. Daily copies are kept 35 days; one a month is kept for good.',
    default: false,
  },
  // One model per AI task; empty means the task's built-in default.
  ...AI_TASKS.map(
    (t): SettingDefinition => ({
      key: `ai.model.${t.id}`,
      section: 'ai',
      type: 'model',
      label: t.label,
      help: t.description,
      default: null,
    }),
  ),
];

export const settingDefinition = (key: string) => SETTINGS.find((s) => s.key === key);

/** Check a value against its definition. Null resets to the default. */
export function settingProblem(def: SettingDefinition, value: unknown): string | null {
  if (value === null) return null;
  if (def.type === 'boolean')
    return typeof value === 'boolean' ? null : `${def.label} must be on or off`;
  if (def.type === 'model') {
    return typeof value === 'string' && /^[a-z0-9.:-]{3,120}$/.test(value)
      ? null
      : `${def.label} needs a model id`;
  }
  return 'Unknown setting type';
}
