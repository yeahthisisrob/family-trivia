/**
 * Family settings on the server: saved value (config/settings.json), then
 * environment, then default, with the source reported (shared/src/settings.ts).
 */
import {
  type ResolvedSetting,
  SETTINGS,
  type SettingValue,
  settingDefinition,
  settingProblem,
} from '@family-trivia/shared';
import { getJson, putJson } from './s3';

const KEY = 'config/settings.json';
type Stored = Record<string, SettingValue>;

const fromEnv = (name?: string): SettingValue | undefined => {
  const raw = name ? process.env[name] : undefined;
  if (raw === undefined || raw === '') return undefined;
  return raw === 'true' ? true : raw === 'false' ? false : raw;
};

export async function resolveSettings(): Promise<ResolvedSetting[]> {
  const stored = (await getJson<Stored>(KEY)) ?? {};
  return SETTINGS.map((def) => {
    if (def.key in stored && stored[def.key] !== null)
      return { ...def, value: stored[def.key] ?? null, source: 'stored' };
    const env = fromEnv(def.env);
    if (env !== undefined) return { ...def, value: env, source: 'env' };
    return { ...def, value: def.default, source: 'default' };
  });
}

export async function getSetting(key: string): Promise<SettingValue> {
  return (await resolveSettings()).find((s) => s.key === key)?.value ?? null;
}

/** Save some settings; null resets one to its default. Returns problems instead of saving any. */
export async function saveSettings(values: Record<string, unknown>): Promise<string[]> {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const def = settingDefinition(key);
    if (!def) problems.push(`Unknown setting ${key}`);
    else {
      const p = settingProblem(def, value);
      if (p) problems.push(p);
    }
  }
  if (problems.length) return problems;
  const stored = (await getJson<Stored>(KEY)) ?? {};
  for (const [key, value] of Object.entries(values)) {
    if (value === null) delete stored[key];
    else stored[key] = value as SettingValue;
  }
  await putJson(KEY, stored);
  return [];
}
