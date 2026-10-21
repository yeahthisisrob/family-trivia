// File: src/AppProvider.tsx
// Top-level provider — gates data contexts behind auth so no API calls
// fire until the user has a JWT from Google OAuth.

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import App from './App';
import { LoginScreen } from './components/AppShell';
import { FamilyDataProvider } from './contexts/FamilyDataContext';
import { TimelineProvider } from './contexts/TimelineContext';
import { TriviaProvider } from './contexts/TriviaContext';
import { UserStatusProvider } from './contexts/UserStatusContext';
import { JoinScreen } from './features/invites';
import { RememberScreen } from './features/memory-links';
import { apiService } from './shared/api/ApiService';
import { configureLogging, loadConfig } from './shared/config/config';
import { createLogger, LogLevel } from './shared/lib/logger';
import { loadSession, onSessionExpired, saveSession } from './shared/session/session';

const logger = createLogger('AppProvider');

const AppProvider: React.FC = () => {
  const [initialSession] = useState(() => loadSession());
  const [userId, setUserId] = useState<string | null>(initialSession);
  const [authValid, setAuthValid] = useState(!!initialSession);
  const [googleClientId, setGoogleClientId] = useState('');

  // Load Google Client ID from config.json (deployed by CDK stack)
  useEffect(() => {
    loadConfig()
      .then((cfg) => {
        setGoogleClientId(cfg.REACT_APP_GOOGLE_CLIENT_ID || '');
      })
      .catch(() => {
        logger.error('Failed to load config for Google Client ID');
      });
  }, []);

  useEffect(() => {
    configureLogging(import.meta.env.PROD ? LogLevel.ERROR : LogLevel.INFO);
  }, []);

  // The session ran out while the app was open (or since the last visit).
  const [expired, setExpired] = useState(false);
  useEffect(
    () =>
      onSessionExpired(() => {
        apiService.clearCache();
        setExpired(true);
        setAuthValid(false);
        setUserId(null);
      }),
    [],
  );

  const handleUserChange = useCallback((newUserId: string | null) => {
    setUserId(newUserId);
  }, []);

  const handleAuthChange = useCallback((isAuth: boolean) => {
    setAuthValid(isAuth);
  }, []);

  // Called from LoginScreen after successful Google auth
  const handleLoginActivate = useCallback((newUserId: string, valid: boolean, token: string) => {
    if (valid) {
      saveSession(newUserId, token);
      setExpired(false);
      setUserId(newUserId);
      setAuthValid(true);
    }
  }, []);

  // Clear API cache when user changes
  useEffect(() => {
    if (userId && authValid) {
      apiService.clearCache();
    }
  }, [userId, authValid]);

  // ── An invite link (/join?t=…) opens its own page, signed in or not. ──
  const joinToken =
    window.location.pathname === '/join'
      ? new URLSearchParams(window.location.search).get('t')
      : null;
  if (joinToken) {
    if (!googleClientId) return null;
    return <JoinScreen token={joinToken} googleClientId={googleClientId} />;
  }

  // ── A memory link (/remember?t=…): anyone can add a memory, no sign-in (0027). ──
  const rememberToken =
    window.location.pathname === '/remember'
      ? new URLSearchParams(window.location.search).get('t')
      : null;
  if (rememberToken) return <RememberScreen token={rememberToken} />;

  // ── Pre-auth: show login screen. No providers = no API calls. ──
  if (!userId || !authValid) {
    // Wait for config to load before rendering login (needs Google Client ID)
    if (!googleClientId) {
      return null; // Brief flash while config.json loads
    }
    return (
      <LoginScreen
        googleClientId={googleClientId}
        onActivate={handleLoginActivate}
        notice={expired ? "Welcome back! It's been a while, so please sign in again." : undefined}
      />
    );
  }

  // ── Post-auth: mount all providers + the app. ──
  return (
    <FamilyDataProvider userId={userId}>
      <TriviaProvider>
        <TimelineProvider>
          <UserStatusProvider userId={userId} authValid={authValid}>
            <App onUserChange={handleUserChange} onAuthChange={handleAuthChange} />
          </UserStatusProvider>
        </TimelineProvider>
      </TriviaProvider>
    </FamilyDataProvider>
  );
};

export default AppProvider;
