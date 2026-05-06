// File: src/AppProvider.tsx
// Top-level provider — gates data contexts behind auth so no API calls
// fire until the user has a JWT from Google OAuth.

import React, { useState, useEffect, useCallback } from 'react';

import App from './App';
import { LoginScreen } from './components/AppShell';
import { configureLogging, loadConfig } from './config';
import { FamilyDataProvider } from './contexts/FamilyDataContext';
import { TimelineProvider } from './contexts/TimelineContext';
import { TriviaProvider } from './contexts/TriviaContext';
import { UserStatusProvider } from './contexts/UserStatusContext';
import { apiService } from './services/ApiService';
import { loadSession, saveSession } from './session';
import { LogLevel, createLogger } from './utils/logger';

const logger = createLogger('AppProvider');

const AppProvider: React.FC = () => {
  const [initialSession] = useState(() => loadSession());
  const [userId, setUserId] = useState<string | null>(initialSession);
  const [authValid, setAuthValid] = useState(!!initialSession);
  const [googleClientId, setGoogleClientId] = useState('');

  // Load Google Client ID from config.json (deployed by CDK stack)
  useEffect(() => {
    loadConfig().then(cfg => {
      setGoogleClientId(cfg.REACT_APP_GOOGLE_CLIENT_ID || '');
    }).catch(() => {
      logger.error('Failed to load config for Google Client ID');
    });
  }, []);

  useEffect(() => {
    configureLogging(import.meta.env.PROD ? LogLevel.ERROR : LogLevel.INFO);
  }, []);

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
