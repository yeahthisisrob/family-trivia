// File: src/App.tsx
import { Box, Container, Typography } from '@mui/material';
import React from 'react';

import { AppHeader } from './components/AppShell';
import { DailyFactCard } from './components/DailyFact';
import DailyFactSummary from './components/DailyFactSummary';
import { EndOfSeason } from './components/EndOfSeason';
import FamilyFeud from './components/FamilyFeud';
import StatusGridToggle from './components/StatusGridToggle';
import TimelineBoard from './components/TimelineBoard';
import TriviaTab from './components/TriviaCard';
import UpcomingDates from './components/UpcomingDates';
import { LeaderboardProvider } from './contexts/LeaderboardContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useApp, ROUTES } from './hooks/useApp';
import { createLogger } from './utils/logger';

// Lazy-loaded: these chunks are deferred until the route is first visited
const AdminPage = React.lazy(() => import('./components/Admin'));
const ArcadePage = React.lazy(() => import('./components/Arcade/ArcadePage'));
const FamilyTree = React.lazy(() => import('./components/FamilyTree'));
const Leaderboard = React.lazy(() => import('./components/Leaderboard'));
const PhotosPage = React.lazy(() => import('./components/Photos'));
const Profile = React.lazy(() => import('./components/Profile'));
const SetupWizard = React.lazy(() => import('./components/SetupWizard/SetupWizard'));

const logger = createLogger('App');

interface AppProps {
  onUserChange: (userId: string | null) => void;
  onAuthChange: (isAuth: boolean) => void;
}

const App: React.FC<AppProps> = ({ onUserChange, onAuthChange }) => {
  const [leaderboardMounted, setLeaderboardMounted] = React.useState(false);
  const [familyMounted, setFamilyMounted] = React.useState(false);
  const [arcadeMounted, setArcadeMounted] = React.useState(false);
  const [photosMounted, setPhotosMounted] = React.useState(false);
  const [highlightContentId, setHighlightContentId] = React.useState<string | null>(null);
  // "Skip for now" on the inline card hides it for the rest of the session.
  const INLINE_DISMISS_KEY = 'dailyFactInlineDismissed';
  const [factInlineDismissed, setFactInlineDismissed] = React.useState(() => {
    try { return window.sessionStorage.getItem(INLINE_DISMISS_KEY) === '1'; }
    catch { return false; }
  });
  const dismissInlineFact = React.useCallback(() => {
    try { window.sessionStorage.setItem(INLINE_DISMISS_KEY, '1'); } catch { /* ok */ }
    setFactInlineDismissed(true);
  }, []);

  const {
    selectedUser,
    profileUser,
    authValid,
    currentPath,
    factRefreshKey,
    debugMode,
    endOfSeasonStatus,
    myGroup,
    isAdmin,
    familyData,
    userStatus,
    handleLogout,
    handleAnswerSubmit,
    handleFactSubmit,
    navigateTo,
    navigateToProfile,
    setProfileUser,
    setTab,
    endOfSeasonDismissed,
    setEndOfSeasonDismissed,
    isSeasonActive,
    isAppReady,
  } = useApp({ onUserChange, onAuthChange });

  // Lazy-mount heavy tabs: only mount on first visit, keep mounted after
  React.useEffect(() => {
    if (currentPath === ROUTES.LEADERBOARD && !leaderboardMounted) setLeaderboardMounted(true);
    if (currentPath === ROUTES.FAMILY && !familyMounted) setFamilyMounted(true);
    if (currentPath === ROUTES.ARCADE && !arcadeMounted) setArcadeMounted(true);
    if (currentPath === ROUTES.PHOTOS && !photosMounted) setPhotosMounted(true);
  }, [currentPath, leaderboardMounted, familyMounted, arcadeMounted, photosMounted]);

  // Reset scroll on every tab change. Tabs are kept mounted under
  // display:none, so the window scroll position is shared across all of
  // them — without this, switching from a long-scrolled Arcade page to
  // Trivia leaves the user mid-page.
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPath]);

  // Auth is handled by AppProvider — if we're here, user is always authenticated.
  // Non-null assertion is safe because AppProvider only renders App when userId is set.
  const user = selectedUser!;

  // First-time setup wizard — show before anything else
  if (familyData.isFirstRun && isAppReady) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
        <Container maxWidth="sm" sx={{ py: 3 }}>
          <React.Suspense fallback={null}>
            <SetupWizard onComplete={() => window.location.reload()} />
          </React.Suspense>
        </Container>
      </Box>
    );
  }

  // --- Page components defined inline to keep props in scope ---

  const HomePage = (
    <Box>
      {/* End of season modal — only after app is fully ready */}
      <EndOfSeason
        open={!!endOfSeasonStatus?.isEndOfSeason && !endOfSeasonDismissed}
        onDismiss={() => setEndOfSeasonDismissed(true)}
        personalMessage={endOfSeasonStatus?.personalMessage || ''}
        lastSeason={endOfSeasonStatus?.lastSeason}
        questionsBehind={userStatus.catchupStatus?.questionsBehind || 0}
        onCatchUp={() => {
          const currentStatus = userStatus.catchupStatus;
          if (currentStatus) {
            userStatus.updateCatchupStatus({
              ...currentStatus,
              questionsBehind: Math.max(2, currentStatus.questionsBehind),
            });
          }
        }}
        factsBehind={0}
        onCatchUpFacts={() => {
          setTab(ROUTES.HOME);
        }}
      />

      {!factInlineDismissed && (
        <DailyFactCard
          userId={user}
          onFactSubmitted={handleFactSubmit}
          onDismiss={dismissInlineFact}
        />
      )}

      <StatusGridToggle userId={user} />

      <FamilyFeud userId={user} />

      <UpcomingDates />

      <DailyFactSummary onUserClick={navigateToProfile} />

      <TimelineBoard
        members={familyData.members}
        refreshKey={factRefreshKey}
        onUserClick={navigateToProfile}
        currentUserId={user}
        highlightContentId={highlightContentId}
        onHighlightConsumed={() => setHighlightContentId(null)}
      />
    </Box>
  );

  const TriviaPage = (
    <Box>
      {/* Season status banner */}
      {endOfSeasonStatus && !isSeasonActive && (
        <Box
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2,
            bgcolor: 'rgba(255, 152, 0, 0.06)',
            border: 1,
            borderColor: 'rgba(255, 152, 0, 0.15)',
          }}
        >
          <Typography variant="subtitle2" color="secondary" sx={{ fontWeight: 600 }}>
            {endOfSeasonStatus.isBetweenSeasons
              ? 'Between Seasons'
              : `Season ${endOfSeasonStatus.lastSeason?.seasonNumber || ''} Has Ended`}
          </Typography>
          {endOfSeasonStatus.lastSeason && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {endOfSeasonStatus.lastSeason.message || 'Thanks for playing! A new season will begin soon.'}
            </Typography>
          )}
          {endOfSeasonStatus.nextSeasonStart && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Next season starts: {new Date(endOfSeasonStatus.nextSeasonStart).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      )}

      {isSeasonActive ? (
        <TriviaTab
          userId={user}
          groupId={myGroup}
          onAnswerResult={handleAnswerSubmit}
        />
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Trivia questions will be available when a new season starts.
          </Typography>
          <Typography
            variant="body2"
            color="primary"
            sx={{ mt: 2, cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setTab(ROUTES.HOME)}
          >
            Check out the timeline while you wait
          </Typography>
        </Box>
      )}
    </Box>
  );

  const LeaderboardPage = (
    <Box>
      <Leaderboard
        userId={user}
        groupId={myGroup}
        onViewProfile={navigateToProfile}
      />
    </Box>
  );

  const FamilyPage = (
    <Box>
      <FamilyTree userId={user} onViewProfile={navigateToProfile} />
    </Box>
  );

  const ArcadePageContent = (
    <Box>
      <ArcadePage userId={user} />
    </Box>
  );

  return (
    <NotificationProvider userId={user}>
    <LeaderboardProvider>
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader
        selectedUser={user}
        onLogout={handleLogout}
        currentPath={currentPath}
        onNavigate={navigateTo}
        isAdmin={isAdmin}
        loading={!isAppReady}
        onAvatarClick={() => setProfileUser(user)}
        onNotificationClick={(item) => {
          // Route to the tab that owns the content being discussed.
          // album_added notifications are also 'album' contentType.
          if (item.contentType === 'album') {
            navigateTo(ROUTES.PHOTOS);
            return;
          }
          if (item.contentType === 'arcade') {
            navigateTo(ROUTES.ARCADE);
            return;
          }
          if (item.contentType && item.contentId) {
            setHighlightContentId(`${item.contentType}:${item.contentId}`);
            navigateTo(ROUTES.HOME);
          }
        }}
      />
      {isAppReady ? (
      <Box sx={{ flex: 1, p: 2, bgcolor: 'grey.50' }}>
        <Container maxWidth="sm">
          {/* Profile route — shown as overlay when URL matches */}
          {profileUser && user && (
            <React.Suspense fallback={null}>
              <Profile
                userId={profileUser}
                isCurrentUser={profileUser === user}
                onBackToLeaderboard={() => setProfileUser(null)}
              />
            </React.Suspense>
          )}

          {/* Regular page content — hidden when profile is open */}
          {!profileUser && (
            <>
              {/* Home Tab */}
              <Box sx={{ display: currentPath === ROUTES.HOME ? 'block' : 'none' }}>
                {HomePage}
              </Box>

              {/* Trivia Tab — kept mounted to preserve TriviaCard state */}
              <Box sx={{ display: currentPath === ROUTES.PLAY ? 'block' : 'none' }}>
                {TriviaPage}
              </Box>

              {/* Leaderboard Tab — lazy-mounted on first visit, kept mounted after */}
              {(currentPath === ROUTES.LEADERBOARD || leaderboardMounted) && (
                <Box sx={{ display: currentPath === ROUTES.LEADERBOARD ? 'block' : 'none' }}>
                  <React.Suspense fallback={null}>
                    {LeaderboardPage}
                  </React.Suspense>
                </Box>
              )}

              {/* Family Tree Tab — lazy-mounted on first visit, kept mounted after */}
              {(currentPath === ROUTES.FAMILY || familyMounted) && (
                <Box sx={{ display: currentPath === ROUTES.FAMILY ? 'block' : 'none' }}>
                  <React.Suspense fallback={null}>
                    {FamilyPage}
                  </React.Suspense>
                </Box>
              )}

              {/* Photos Tab — lazy-mounted on first visit, kept mounted after */}
              {(currentPath === ROUTES.PHOTOS || photosMounted) && (
                <Box sx={{ display: currentPath === ROUTES.PHOTOS ? 'block' : 'none' }}>
                  <React.Suspense fallback={null}>
                    <PhotosPage userId={user} isAdmin={isAdmin} />
                  </React.Suspense>
                </Box>
              )}

              {/* Arcade Tab — lazy-mounted on first visit, kept mounted after */}
              {(currentPath === ROUTES.ARCADE || arcadeMounted) && (
                <Box sx={{ display: currentPath === ROUTES.ARCADE ? 'block' : 'none' }}>
                  <React.Suspense fallback={null}>
                    {ArcadePageContent}
                  </React.Suspense>
                </Box>
              )}

              {/* Admin — uses nested Routes for sub-tabs */}
              {currentPath.startsWith(ROUTES.ADMIN) && isAdmin && (
                <React.Suspense fallback={null}>
                  <AdminPage userId={user} />
                </React.Suspense>
              )}
            </>
          )}
        </Container>


        {/* Debug mode indicator */}
        {debugMode && (
          <Box
            onClick={() => {
              if (authValid && user && !endOfSeasonStatus?.isEndOfSeason) {
                logger.info('DEBUG: Switching to home tab for fact prompt');
                setTab(ROUTES.HOME);
              }
            }}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              bgcolor: 'warning.main',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 2,
              boxShadow: 3,
              zIndex: 9999,
              fontSize: '0.875rem',
              fontWeight: 'bold',
              cursor: authValid && user ? 'pointer' : 'not-allowed',
              opacity: authValid && user ? 1 : 0.7,
              transition: 'all 0.2s',
              '&:hover':
                authValid && user
                  ? {
                      bgcolor: 'warning.dark',
                      transform: 'scale(1.05)',
                    }
                  : {},
            }}
          >
            DEBUG MODE {authValid && user ? '(Click for Daily Fact)' : '(Login first)'}
          </Box>
        )}
      </Box>
      ) : null}
    </Box>
    </LeaderboardProvider>
    </NotificationProvider>
  );
};

export default App;
