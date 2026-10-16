/** Family settings (backend/features/settings, shared/src/settings.ts). */
import type {
  AiTask,
  ModelInfo,
  ResolvedSetting,
  SettingValue,
  UsageMonth,
} from '@family-trivia/shared';
import type React from 'react';
import { createContext, createElement, useContext, useEffect, useState } from 'react';
import { apiService } from '../../services/ApiService';

export interface AdminSettings {
  settings: ResolvedSetting[];
  models: (ModelInfo & { availability: { ok: boolean; reason?: string } | null })[];
  availabilityCheckedAt: string;
  tasks: (AiTask & { model: string })[];
  defaults: { writer: string; fast: string };
  players: number;
  usage: { thisMonth: UsageMonth; lastMonth: UsageMonth };
}

export type Features = { photos: boolean; familyFeud: boolean; arcade: boolean };
const ALL_ON: Features = { photos: true, familyFeud: true, arcade: true };

export const settingsApi = {
  features: () =>
    apiService.request<Features>('/settings/features', { method: 'GET' }, undefined, true),
  admin: (refreshModels = false) =>
    apiService.request<AdminSettings>(
      `/admin/settings${refreshModels ? '?refreshModels=1' : ''}`,
      { method: 'GET' },
      undefined,
      true,
    ),
  save: (values: Record<string, SettingValue>) =>
    apiService.request<AdminSettings>('/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }),
};

const FeaturesCtx = createContext<Features>(ALL_ON);

/** Loads which optional parts of the app are on; everything shows until it knows. */
export const FeaturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<Features>(ALL_ON);
  useEffect(() => {
    settingsApi
      .features()
      .then((f) => setFeatures({ ...ALL_ON, ...f }))
      .catch(() => undefined);
  }, []);
  return createElement(FeaturesCtx.Provider, { value: features }, children);
};

export const useFeatures = () => useContext(FeaturesCtx);
