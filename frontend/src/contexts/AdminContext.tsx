// File: frontend/src/contexts/AdminContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

import * as adminApi from '../api/modules/admin';
import { createLogger } from '../utils/logger';

const logger = createLogger('AdminContext');

interface AdminContextValue {
  // Identity
  adminUserId: string;

  // Data
  players: adminApi.PlayerConfig[];
  groups: adminApi.GroupConfig[];
  sides: Record<string, adminApi.SideConfig>;
  seasons: adminApi.SeasonConfig[];
  currentSeasonNumber: number | null;
  rootPartners: { id: string; name: string; role?: string }[];

  // Loading
  loading: boolean;
  error: string | null;

  // Actions
  loadPlayers: () => Promise<void>;
  loadGroups: () => Promise<void>;
  loadFamilyTree: () => Promise<void>;
  loadSeasons: () => Promise<void>;
  loadAll: () => Promise<void>;

  // Player CRUD
  addPlayer: (data: Parameters<typeof adminApi.addPlayer>[1]) => Promise<void>;
  updatePlayer: (data: Parameters<typeof adminApi.updatePlayer>[1]) => Promise<void>;
  deletePlayer: (userId: string) => Promise<void>;

  // Group CRUD
  addGroup: (data: Parameters<typeof adminApi.addGroup>[1]) => Promise<void>;
  updateGroup: (data: Parameters<typeof adminApi.updateGroup>[1]) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;

  // Family Tree
  updateFamilyTree: (data: Parameters<typeof adminApi.updateFamilyTree>[1]) => Promise<void>;

  // Season CRUD
  addSeason: (data: Parameters<typeof adminApi.addSeason>[1]) => Promise<void>;
  updateSeason: (data: Parameters<typeof adminApi.updateSeason>[1]) => Promise<void>;
  deleteSeason: (seasonNumber: number) => Promise<void>;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}

interface AdminProviderProps {
  adminUserId: string;
  children: React.ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ adminUserId, children }) => {
  const [players, setPlayers] = useState<adminApi.PlayerConfig[]>([]);
  const [groups, setGroups] = useState<adminApi.GroupConfig[]>([]);
  const [sides, setSides] = useState<Record<string, adminApi.SideConfig>>({});
  const [seasons, setSeasons] = useState<adminApi.SeasonConfig[]>([]);
  const [currentSeasonNumber, setCurrentSeasonNumber] = useState<number | null>(null);
  const [rootPartners, setRootPartners] = useState<{ id: string; name: string; role?: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    try {
      const data = await adminApi.getPlayers(adminUserId);
      setPlayers(data);
    } catch (err) {
      logger.error('Failed to load players', err);
      setError('Failed to load players');
    }
  }, [adminUserId]);

  const loadGroups = useCallback(async () => {
    try {
      const data = await adminApi.getGroups(adminUserId);
      setGroups(data.groups);
      setSides(data.sides);
    } catch (err) {
      logger.error('Failed to load groups', err);
      setError('Failed to load groups');
    }
  }, [adminUserId]);

  const loadFamilyTree = useCallback(async () => {
    try {
      const data = await adminApi.getFamilyTree(adminUserId);
      setRootPartners(data.rootPartners);
      setSides(data.sides);
    } catch (err) {
      logger.error('Failed to load family tree', err);
      setError('Failed to load family tree');
    }
  }, [adminUserId]);

  const loadSeasons = useCallback(async () => {
    try {
      const data = await adminApi.getSeasons(adminUserId);
      setSeasons(data.seasons);
      setCurrentSeasonNumber(data.currentSeasonNumber);
    } catch (err) {
      logger.error('Failed to load seasons', err);
      setError('Failed to load seasons');
    }
  }, [adminUserId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPlayers(), loadGroups(), loadFamilyTree(), loadSeasons()]);
    } finally {
      setLoading(false);
    }
  }, [loadPlayers, loadGroups, loadFamilyTree, loadSeasons]);

  // ── Player CRUD wrappers ─────────────────────────────────────

  const addPlayer = useCallback(
    async (data: Parameters<typeof adminApi.addPlayer>[1]) => {
      await adminApi.addPlayer(adminUserId, data);
      await loadPlayers();
    },
    [adminUserId, loadPlayers],
  );

  const updatePlayer = useCallback(
    async (data: Parameters<typeof adminApi.updatePlayer>[1]) => {
      await adminApi.updatePlayer(adminUserId, data);
      await loadPlayers();
    },
    [adminUserId, loadPlayers],
  );

  const deletePlayer = useCallback(
    async (userId: string) => {
      await adminApi.deletePlayer(adminUserId, userId);
      await loadPlayers();
    },
    [adminUserId, loadPlayers],
  );

  // ── Group CRUD wrappers ──────────────────────────────────────

  const addGroup = useCallback(
    async (data: Parameters<typeof adminApi.addGroup>[1]) => {
      await adminApi.addGroup(adminUserId, data);
      await loadGroups();
    },
    [adminUserId, loadGroups],
  );

  const updateGroup = useCallback(
    async (data: Parameters<typeof adminApi.updateGroup>[1]) => {
      await adminApi.updateGroup(adminUserId, data);
      await loadGroups();
    },
    [adminUserId, loadGroups],
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      await adminApi.deleteGroup(adminUserId, groupId);
      await loadGroups();
    },
    [adminUserId, loadGroups],
  );

  // ── Family Tree wrapper ──────────────────────────────────────

  const updateFamilyTreeAction = useCallback(
    async (data: Parameters<typeof adminApi.updateFamilyTree>[1]) => {
      await adminApi.updateFamilyTree(adminUserId, data);
      await loadFamilyTree();
    },
    [adminUserId, loadFamilyTree],
  );

  // ── Season CRUD wrappers ─────────────────────────────────────

  const addSeason = useCallback(
    async (data: Parameters<typeof adminApi.addSeason>[1]) => {
      await adminApi.addSeason(adminUserId, data);
      await loadSeasons();
    },
    [adminUserId, loadSeasons],
  );

  const updateSeason = useCallback(
    async (data: Parameters<typeof adminApi.updateSeason>[1]) => {
      await adminApi.updateSeason(adminUserId, data);
      await loadSeasons();
    },
    [adminUserId, loadSeasons],
  );

  const deleteSeason = useCallback(
    async (seasonNumber: number) => {
      await adminApi.deleteSeason(adminUserId, seasonNumber);
      await loadSeasons();
    },
    [adminUserId, loadSeasons],
  );

  const value: AdminContextValue = {
    adminUserId,
    players,
    groups,
    sides,
    seasons,
    currentSeasonNumber,
    rootPartners,
    loading,
    error,
    loadPlayers,
    loadGroups,
    loadFamilyTree,
    loadSeasons,
    loadAll,
    addPlayer,
    updatePlayer,
    deletePlayer,
    addGroup,
    updateGroup,
    deleteGroup,
    updateFamilyTree: updateFamilyTreeAction,
    addSeason,
    updateSeason,
    deleteSeason,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
