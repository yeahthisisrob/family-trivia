// File: src/App.tsx
import { Box, Container, Typography } from '@mui/material';
import React from 'react';
import { markSeasonLetterSeen } from './api/modules/seasons';
import { AppHeader } from './components/AppShell';
import { TriviaTabs } from './components/AppShell/TriviaTabs';
import { DailyFactCard } from './components/DailyFact';
import DailyFactSummary from './components/DailyFactSummary';
import FamilyFeud from './components/FamilyFeud';
import { SeasonLetter } from './components/SeasonLetter/SeasonLetter';
import StatusGridToggle from './components/StatusGridToggle';
import TimelineBoard from './components/TimelineBoard';
import TriviaTab from './components/TriviaCard';
import { LeaderboardProvider } from './contexts/LeaderboardContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { appearanceApi } from './entities/appearance';
import { useFeatures } from './entities/settings';
import { UpcomingDates } from './features/celebrations';
import { DailyMemory } from './features/daily-memory';
import { ROUTES, useApp } from './hooks/useApp';
import { colors, tint, useAppearance } from './shared/design-system';
import { createLogger } from './utils/logger';

// Lazy-loaded: these chunks are deferred until the route is first visited
const AdminPage = React.lazy(() => import('./components/Admin'));
const ArcadePage = React.lazy(() => import('./components/Arcade/ArcadePage'));
const FamilyTree = React.lazy(() => import('./components/FamilyTree'));
const Leaderboard = React.lazy(() => import('./components/Leaderboard'));
const StoryProfile = React.lazy(() =>
  import('./features/profile').then((m) => ({ default: m.StoryProfile })),
);
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
  const [highlightContentId, setHighlightContentId] = React.useState<string | null>(null);
  // "Skip for now" on the inline card hides it for the rest of the session.
  const INLINE_DISMISS_KEY = 'dailyFactInlineDismissed';
  const [factInlineDismissed, setFactInlineDismissed] = React.useState(() => {
    try {
      return window.sessionStorage.getItem(INLINE_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const dismissInlineFact = React.useCallback(() => {
    try {
      window.sessionStorage.setItem(INLINE_DISMISS_KEY, '1');
    } catch {
      /* ok */
    }
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
    isTriviaOn,
    isAppReady,
  } = useApp({ onUserChange, onAuthChange });

  // The family's default theme applies to everyone who hasn't picked their own.
  const { setFamilyTheme } = useAppearance();
  const features = useFeatures();
  React.useEffect(() => {
    if (!authValid) return;
    appearanceApi
      .get()
      .then((a) => setFamilyTheme(a.themeId))
      .catch(() => undefined);
  }, [authValid, setFamilyTheme]);

  // Lazy-mount heavy tabs: only mount on first visit, keep mounted after
  React.useEffect(() => {
    if (currentPath === ROUTES.LEADERBOARD && !leaderboardMounted) setLeaderboardMounted(true);
    if (currentPath === ROUTES.FAMILY && !familyMounted) setFamilyMounted(true);
    if (currentPath === ROUTES.ARCADE && !arcadeMounted) setArcadeMounted(true);
  }, [currentPath, leaderboardMounted, familyMounted, arcadeMounted]);

  // A season without trivia has nothing to play: a link or a refresh on Play
  // lands on the results instead.
  React.useEffect(() => {
    if (currentPath === ROUTES.PLAY && isSeasonActive && !isTriviaOn) {
      navigateTo(ROUTES.LEADERBOARD);
    }
  }, [currentPath, isSeasonActive, isTriviaOn, navigateTo]);

  // Reset scroll on every tab change. Tabs are kept mounted under
  // display:none, so the window scroll position is shared across all of
  // them — without this, switching from a long-scrolled Arcade page to
  // Trivia leaves the user mid-page.
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPath]);

  // Auth is handled by AppProvider — if we're here, user is always authenticated.
  // Non-null assertion is safe because AppProvider only renders App when userId is set.
  // biome-ignore lint/style/noNonNullAssertion: AppProvider renders App only once signed in.
  const user = selectedUser!;

  // First-time setup wizard — show before anything else
  if (familyData.isFirstRun && isAppReady) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
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
      {/* The season letter: shown once per person, remembered on every device */}
      {endOfSeasonStatus?.letter && !endOfSeasonDismissed && (
        <SeasonLetter
          letter={endOfSeasonStatus.letter}
          seasonName={
            (endOfSeasonStatus.letter.kind === 'end'
              ? endOfSeasonStatus.lastSeason
              : endOfSeasonStatus.currentSeason
            )?.name
          }
          onClose={() => {
            setEndOfSeasonDismissed(true);
            const letter = endOfSeasonStatus.letter;
            if (letter)
              markSeasonLetterSeen(letter.seasonNumber, letter.kind).catch(() => undefined);
          }}
        />
      )}

      {/* Between seasons nothing new is asked: no daily fact prompt */}
      {isSeasonActive && !factInlineDismissed && (
        <DailyFactCard
          userId={user}
          onFactSubmitted={handleFactSubmit}
          onDismiss={dismissInlineFact}
        />
      )}

      {/* A page from our past, every day: at the top between seasons, under the day's question in one */}
      <DailyMemory
        me={user}
        nameOf={(id) => familyData.members.find((m) => m.userId === id)?.name ?? id}
        onOpenPerson={navigateToProfile}
      />

      <StatusGridToggle userId={user} />

      {/* Family Feud asks questions too, so it also waits for a season */}
      {isSeasonActive && features.familyFeud && <FamilyFeud userId={user} />}

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
            bgcolor: tint(colors.brand.secondary, 0.06),
            border: 1,
            borderColor: tint(colors.brand.secondary, 0.15),
          }}
        >
          <Typography variant="subtitle2" color="secondary" sx={{ fontWeight: 600 }}>
            {endOfSeasonStatus.isBetweenSeasons
              ? 'Between Seasons'
              : `Season ${endOfSeasonStatus.lastSeason?.seasonNumber || ''} Has Ended`}
          </Typography>
          {endOfSeasonStatus.lastSeason && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mt: 0.5,
              }}
            >
              {endOfSeasonStatus.lastSeason.message ||
                'Thanks for playing! A new season will begin soon.'}
            </Typography>
          )}
          {endOfSeasonStatus.nextSeasonStart && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                mt: 0.5,
                display: 'block',
              }}
            >
              Next season starts: {new Date(endOfSeasonStatus.nextSeasonStart).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      )}

      {isTriviaOn ? (
        <TriviaTab userId={user} groupId={myGroup} onAnswerResult={handleAnswerSubmit} />
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
            }}
          >
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
      <Leaderboard userId={user} groupId={myGroup} onViewProfile={navigateToProfile} />
    </Box>
  );

  const FamilyPage = (
    <Box>
      <FamilyTree userId={user} isAdmin={isAdmin} onViewProfile={navigateToProfile} />
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
            // Between seasons, or in a season without trivia, there's nothing to
            // play: Trivia opens on the results.
            onNavigate={(path) =>
              navigateTo(path === ROUTES.PLAY && !isTriviaOn ? ROUTES.LEADERBOARD : path)
            }
            isAdmin={isAdmin}
            loading={!isAppReady}
            onAvatarClick={() => setProfileUser(user)}
            onNotificationClick={(item) => {
              // Route to the tab that owns the content being discussed.
              // album_added notifications are also 'album' contentType.
              if (item.contentType === 'album') {
                navigateTo(ROUTES.FAMILY); // albums live on the Family tab
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
            <Box sx={{ flex: 1, p: 2, bgcolor: 'background.default' }}>
              <Container maxWidth="sm">
                {/* Profile route — shown as overlay when URL matches */}
                {profileUser && user && (
                  <React.Suspense fallback={null}>
                    <StoryProfile
                      userId={profileUser}
                      meId={user}
                      onBack={() => setProfileUser(null)}
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

                    {(currentPath === ROUTES.PLAY || currentPath === ROUTES.LEADERBOARD) && (
                      <TriviaTabs
                        currentPath={currentPath}
                        onNavigate={navigateTo}
                        factsOnly={isSeasonActive && !isTriviaOn}
                      />
                    )}

                    {/* Trivia Tab — kept mounted to preserve TriviaCard state */}
                    <Box sx={{ display: currentPath === ROUTES.PLAY ? 'block' : 'none' }}>
                      {TriviaPage}
                    </Box>

                    {/* Trivia › Leaderboard — lazy-mounted on first visit, kept mounted after */}
                    {(currentPath === ROUTES.LEADERBOARD || leaderboardMounted) && (
                      <Box sx={{ display: currentPath === ROUTES.LEADERBOARD ? 'block' : 'none' }}>
                        <React.Suspense fallback={null}>{LeaderboardPage}</React.Suspense>
                      </Box>
                    )}

                    {/* Family Tree Tab — lazy-mounted on first visit, kept mounted after */}
                    {(currentPath === ROUTES.FAMILY || familyMounted) && (
                      <Box sx={{ display: currentPath === ROUTES.FAMILY ? 'block' : 'none' }}>
                        <React.Suspense fallback={null}>{FamilyPage}</React.Suspense>
                      </Box>
                    )}

                    {/* Arcade Tab — lazy-mounted on first visit, kept mounted after */}
                    {(currentPath === ROUTES.ARCADE || arcadeMounted) && (
                      <Box sx={{ display: currentPath === ROUTES.ARCADE ? 'block' : 'none' }}>
                        <React.Suspense fallback={null}>{ArcadePageContent}</React.Suspense>
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
