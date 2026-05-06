import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import * as api from '../api';
import { useAppReady } from './useAppReady';
import { EndOfSeasonStatus } from '../api/modules/celebrations';
import { useFamilyData } from '../contexts/FamilyDataContext';
import { useUserStatus } from '../contexts/UserStatusContext';
import { cacheService } from '../services/CacheService';
import { prefetchService } from '../services/PrefetchService';
import { loadSession, saveSession, clearSession } from '../session';
import { createLogger } from '../utils/logger';


const logger = createLogger('App');

interface UseAppOptions {
  onUserChange: (userId: string | null) => void;
  onAuthChange: (isAuth: boolean) => void;
}

/** Canonical route paths used throughout navigation */
export const ROUTES = {
  HOME: '/',
  PLAY: '/play',
  LEADERBOARD: '/leaderboard',
  FAMILY: '/family',
  ARCADE: '/arcade',
  PHOTOS: '/photos',
  ADMIN: '/admin',
  PROFILE: '/profile',
} as const;

export function useApp({ onUserChange, onAuthChange }: UseAppOptions) {
  const navigate = useNavigate();
  const location = useLocation();

  // Restore session synchronously so first render already has the user
  const cachedSession = loadSession();
  const isDebug = import.meta.env.VITE_DEBUG_MODE === 'true';

  // Check if debug-prompt URL parameter is set (read once at init time)
  const debugPromptFromUrl = isDebug && new URLSearchParams(window.location.search).get('debug-prompt') === 'true';

  // Derive profileUser from URL
  const profileUserFromUrl = useMemo(() => {
    const match = location.pathname.match(/^\/profile\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  // Local state (initialize from session if available)
  const [selectedUser, setSelectedUser] = useState<string | null>(cachedSession);
  const [authValid, setAuthValid] = useState(!!cachedSession);
  const [factRefreshKey, setFactRefreshKey] = useState(0);
  const [debugMode] = useState(isDebug);
  const [endOfSeasonDismissed, setEndOfSeasonDismissed] = useState(false);

  // profileUser is now derived from URL
  const profileUser = profileUserFromUrl;

  // Context hooks
  const familyData = useFamilyData();
  const userStatus = useUserStatus();
  const { isAppReady } = useAppReady();

  // Season status from FamilyDataContext (loaded via /app-init)
  const endOfSeasonStatus: EndOfSeasonStatus | null = familyData.seasonStatus;
  const loadingEndOfSeason: boolean = familyData.loadingSeasonStatus;

  // Clean up debug URL parameter
  useEffect(() => {
    if (debugPromptFromUrl) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [debugPromptFromUrl]);


  // Handle user activation — called after Google auth or legacy passphrase
  const handleActivate = useCallback(
    async (userId: string, valid: boolean, token?: string) => {
      if (valid) {
        saveSession(userId, token || '');
        setSelectedUser(userId);
        onUserChange(userId);
        onAuthChange(true);
        setAuthValid(true);
        familyData.updateMemberActivation(userId, true);
        await userStatus.refreshUserStatus();
        prefetchService.prefetchNavigationData(userId);
      }
    },
    [familyData, userStatus, onUserChange, onAuthChange],
  );

  // Handle logout
  const handleLogout = useCallback(() => {
    clearSession();
    setSelectedUser(null);
    onUserChange(null);
    onAuthChange(false);
    setAuthValid(false);
    navigate('/');
    userStatus.clearTodayResult();
  }, [userStatus, onUserChange, onAuthChange, navigate]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    familyData.refreshMembers(true);
  }, [familyData]);

  // Handle answer submit — defer context update to avoid re-rendering
  // TriviaFlow during its result state
  const handleAnswerSubmit = useCallback(
    (
      result: { correct: boolean; streak: number; pointsEarned?: number },
      question?: api.Question,
      selected?: string | null,
    ) => {
      // Defer so TriviaFlow's result state renders first
      setTimeout(() => {
        userStatus.setAnswerResult(result, question, selected || undefined);
      }, 100);
    },
    [userStatus],
  );

  // Handle answer submit for catchup trivia
  const handleCatchupAnswerSubmit = useCallback(
    (
      result: { correct: boolean; streak: number; pointsEarned?: number },
      question?: api.Question,
      selected?: string | null,
    ) => {
      // Store the result so the dialog can display it
      userStatus.setAnswerResult(result, question, selected || undefined);

      // Refresh catch-up status in the background (don't block the dialog)
      if (selectedUser) {
        api.getCatchupStatus(selectedUser).then(updatedStatus => {
          if (updatedStatus.questionsBehind <= 0) {
            userStatus.updateCatchupStatus({
              questionsBehind: 0,
              userAnswerCount: updatedStatus.userAnswerCount,
              maxQuestionsAvailable: updatedStatus.maxQuestionsAvailable,
            });
          }
        }).catch(() => { /* non-critical */ });
      }
    },
    [userStatus, selectedUser],
  );

  // Handle fact submit
  const handleFactSubmit = useCallback(() => {
    setFactRefreshKey((k) => k + 1);
    userStatus.refreshUserStatus();
  }, [userStatus]);

  // Navigate to a route path
  const navigateTo = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Navigate to profile
  const navigateToProfile = useCallback((uid: string) => {
    navigate(`/profile/${encodeURIComponent(uid)}`);
  }, [navigate]);

  // Setter shims for backward compatibility
  const setProfileUser = useCallback((uid: string | null) => {
    if (uid) {
      navigate(`/profile/${encodeURIComponent(uid)}`);
    } else {
      // Go back to whatever tab was active before profile
      navigate(-1);
    }
  }, [navigate]);

  const setTab = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Get group and admin status from user config
  interface CachedUserConfig {
    users: Record<string, { group?: string; isAdmin?: boolean }>;
  }
  const userConfig = cacheService.get('user-config') as CachedUserConfig | null;
  const myGroup =
    selectedUser && userConfig?.users ? userConfig.users[selectedUser]?.group || '' : '';
  const isAdmin = !!(selectedUser && userConfig?.users?.[selectedUser]?.isAdmin);

  // Derived: is there an active season right now?
  const isSeasonActive = !loadingEndOfSeason && !endOfSeasonStatus?.isEndOfSeason;

  return {
    // State
    selectedUser,
    profileUser,
    authValid,
    currentPath: location.pathname,
    factRefreshKey,
    debugMode,
    endOfSeasonStatus,
    endOfSeasonDismissed,
    isSeasonActive,
    isAppReady,
    myGroup,
    isAdmin,

    // Context data
    familyData,
    userStatus,

    // Handlers
    handleActivate,
    handleLogout,
    handleRefresh,
    handleAnswerSubmit,
    handleCatchupAnswerSubmit,
    handleFactSubmit,
    navigateTo,
    navigateToProfile,
    setSelectedUser,
    setProfileUser,
    setTab,
    setEndOfSeasonDismissed,
  };
}
