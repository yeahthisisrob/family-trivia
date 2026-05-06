// components/Profile/index.tsx
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupIcon from '@mui/icons-material/Group';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Typography, Box, Paper, Avatar, useTheme, Fade } from '@mui/material';
import React, { useState, useEffect } from 'react';

import CustomCategorySection from './CustomCategorySection';
import IntegratedGroupDescription from './IntegratedGroupDescription';
import ScoreHistory from './ScoreHistory';
import UserTimeline from './UserTimeline';
import * as api from '../../api';
import { useTimeline } from '../../contexts/TimelineContext';
import { useTrivia } from '../../contexts/TriviaContext';
import { loadSession } from '../../session';
import { getUserGroup } from '../../utils';
import { createLogger } from '../../utils/logger';
import CustomCategoryForm from '../CustomCategoryForm';
import { computePoints } from '../Leaderboard/utils';
import PersonalQuestionsHistory from '../PersonalQuestionsHistory';
import { LoadingDots } from '../ui/feedback';

import type { UserProfile } from '../../api/modules/user';

interface ProfileProps {
  userId: string;
  isCurrentUser?: boolean;
  onBackToLeaderboard?: () => void;
  onUserClick?: (userId: string) => void;
  refreshKey?: number;
}

interface HistoryItem {
  question: {
    question: string;
    choices: string[];
    answer: string;
    category?: string;
    difficulty?: 'easy' | 'normal' | 'hard';
  };
  selectedAnswer: string;
  correct: boolean;
  timestamp: string;
}

// Initialize logger
const logger = createLogger('Profile');

const Profile: React.FC<ProfileProps> = ({
  userId,
  isCurrentUser = false,
  onUserClick,
  refreshKey = 0,
}) => {
  // Use the trivia context to listen for and trigger category refreshes
  const { invalidateCategories, refreshTimestamp } = useTrivia();

  // Use the timeline context for facts and history
  const { timelineData, loading: timelineLoading } = useTimeline();

  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [customCategory, setCustomCategory] = useState<api.CustomCategory | null>(null);
  const [customCategoryFormOpen, setCustomCategoryFormOpen] = useState(false);
  const [scoreHistoryOpen, setScoreHistoryOpen] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const theme = useTheme();

  // Determine if this is the current user's profile
  const currentUserId = loadSession();
  const isProfileOwner = isCurrentUser || userId === currentUserId;

  // Track if data is loaded to avoid unnecessary API calls
  const dataLoadedRef = React.useRef(false);
  const lastUserIdRef = React.useRef(userId);

   
  useEffect(() => {
    const loadProfile = async () => {
      // If the user ID has changed, always reload the data
      if (lastUserIdRef.current !== userId) {
        // Reset data when user changes
        setHistory([]);
        dataLoadedRef.current = false;
      }

      // Use the timeline data for history when available
      if (timelineData && timelineData.trivia) {
        // Filter timeline data for this user
        const userTriviaHistory = timelineData.trivia.filter((item) => item.userId === userId);

        if (userTriviaHistory.length > 0) {
          setHistory(userTriviaHistory);

          // Calculate streak from the history
          let userStreak = 0;
          const sortedHistory = [...userTriviaHistory].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );

          for (let i = 0; i < sortedHistory.length; i++) {
            if (sortedHistory[i].correct) {
              userStreak++;
            } else {
              break;
            }
          }

          setStreak(userStreak);
        }
      }

      // We always need to load profile data to get scoring history
      // Even if we have timeline data, we still need the full profile for score details

      // If we don't have data from timeline context, fall back to regular API calls
      setLoading(true);
      try {
        // Load profile data
        const res = await api.getUserProfile(userId);
        setProfileData(res);
        // History & streak
        const h = Array.isArray(res.history) ? res.history : [];
        setHistory(h);
        setStreak(res.streak || 0);
        // Facts are now handled by UserTimeline component

        // Fetch categories to get user's custom category
        try {
          // Get the latest categories
          const categoriesRes = await api.getCategories(userId);
          setCustomCategory(categoriesRes.lastCustomCategory || null);
        } catch (categoryErr) {
          logger.error('Failed to load custom category:', categoryErr);
          setCustomCategory(null);
        }

        dataLoadedRef.current = true;
        lastUserIdRef.current = userId;
      } catch (err) {
        logger.error('Failed to load profile:', err);
        setHistory([]);
        setStreak(0);
        dataLoadedRef.current = false;
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
    // We intentionally exclude history.length and facts.length to avoid circular dependency
    // This fixes the issue when navigating between different user profiles
  }, [userId, refreshTimestamp, timelineData, timelineLoading]);
   

  // Update loading state when timeline loading changes
  useEffect(() => {
    if (timelineLoading) {
      setLoading(true);
    }
  }, [timelineLoading]);

  // Handle creating a new custom category
  const handleOpenCategoryForm = () => {
    setCustomCategoryFormOpen(true);
  };

  const handleCloseCategoryForm = () => {
    setCustomCategoryFormOpen(false);
  };

  const handleCategoryCreated = (category: api.CustomCategory) => {
    setCustomCategory(category);
    // Invalidate the categories cache to trigger refreshes in all components
    invalidateCategories();
  };

  if (loading) {
    return (
      <Fade in={loading}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 200,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          <LoadingDots mt={0} />
        </Box>
      </Fade>
    );
  }

  // Derived stats
  const answeredCount = history.length;
  const correctCount = history.filter((h) => h.correct).length;
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const score = history.reduce((sum, item) => (item.correct ? sum + computePoints(item) : sum), 0);

  // Helper to pick avatar color
  const getUserColor = (id: string) => {
    const colors = [
      '#1976d2',
      '#388e3c',
      '#d32f2f',
      '#7b1fa2',
      '#c2185b',
      '#0288d1',
      '#fbc02d',
      '#455a64',
    ];
    const hash = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Initials helper
  const getUserInitials = (id: string) => {
    const parts = id.split(/[-_ ]/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : id.slice(0, 2).toUpperCase();
  };

  return (
    <Fade in={!loading}>
      <Box>
        {/* Integrated Player Card with User Info, Group Description and Stats */}
        <Paper
          elevation={3}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            mb: 3,
            transition: 'all 0.3s ease',
            '&:hover': { boxShadow: 6 },
          }}
        >
          {/* Top section with user info */}
          <Box
            sx={{
              position: 'relative',
              pt: { xs: 3, sm: 4 },
              px: { xs: 2, sm: 3 },
              pb: { xs: 2, sm: 3 },
              bgcolor: theme.palette.primary.main,
              color: 'white',
              borderBottom: `4px solid ${getUserColor(userId)}`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: { xs: 'column', sm: 'row' },
                textAlign: { xs: 'center', sm: 'left' },
                mb: 2,
              }}
            >
              <Avatar
                sx={{
                  width: { xs: 80, sm: 88 },
                  height: { xs: 80, sm: 88 },
                  border: '3px solid white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  bgcolor: getUserColor(userId),
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  mr: { xs: 0, sm: 3 },
                  mb: { xs: 2, sm: 0 },
                }}
              >
                {getUserInitials(userId)}
              </Avatar>
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: { xs: 'center', sm: 'flex-start' },
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {userId}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <GroupIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.8 }} />
                  <Typography
                    variant="subtitle1"
                    sx={{
                      borderRadius: 1,
                      py: 0.5,
                      px: 1,
                      bgcolor: 'rgba(255,255,255,0.15)',
                      fontWeight: 'medium',
                    }}
                  >
                    {getUserGroup(userId) || 'Others'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Key Stats Bar */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                mt: 1,
                gap: { xs: 2, sm: 0 },
              }}
            >
              {/* Score */}
              <Box
                onClick={() => setScoreHistoryOpen(true)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: { xs: '30%', sm: 'auto' },
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'scale(1.05)',
                  },
                }}
              >
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                >
                  <EmojiEventsIcon sx={{ mr: 0.5, fontSize: '0.8em' }} />
                  {profileData?.totalScore || score}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.9, display: 'flex', alignItems: 'center' }}
                >
                  <TrendingUpIcon sx={{ fontSize: 14, mr: 0.3 }} />
                  SCORE
                </Typography>
              </Box>

              {/* Streak */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: { xs: '30%', sm: 'auto' },
                }}
              >
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                >
                  <HowToRegIcon sx={{ mr: 0.5, fontSize: '0.8em' }} />
                  {streak}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  STREAK
                </Typography>
              </Box>

              {/* Answered */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: { xs: '30%', sm: 'auto' },
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {answeredCount}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  ANSWERED
                </Typography>
              </Box>

              {/* Accuracy */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: { xs: '30%', sm: 'auto' },
                }}
              >
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 'bold',
                    color: accuracy >= 70 ? 'success.light' : 'warning.light',
                  }}
                >
                  {accuracy}%
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  ACCURACY
                </Typography>
              </Box>

              {/* Category Bonus */}
              {profileData?.categoryBonusStats && profileData.categoryBonusStats.timesBonusEarned > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: { xs: '30%', sm: 'auto' },
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#ff9800',
                    }}
                  >
                    <LocalFireDepartmentIcon sx={{ mr: 0.3, fontSize: '0.8em' }} />
                    {profileData.categoryBonusStats.totalBonusPoints}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    BONUS PTS
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Group Description Section */}
          <Box sx={{ p: 0 }}>
            <Box
              sx={{
                px: 3,
                pt: 2.5,
                pb: 1,
                bgcolor: theme.palette.grey[50],
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <GroupIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.7 }} />
                Group Description
              </Typography>
            </Box>
            <IntegratedGroupDescription userId={userId} isCurrentUser={isProfileOwner} />
          </Box>
        </Paper>

        {/* Custom Category */}
        <CustomCategorySection
          customCategory={customCategory}
          isCurrentUser={isProfileOwner}
          onCreateCategory={handleOpenCategoryForm}
        />

        {/* Personal Questions History - Only show for profile owner */}
        {isProfileOwner && (
          <Box sx={{ mb: 3 }}>
            <PersonalQuestionsHistory userId={userId} />
          </Box>
        )}

        {/* User Timeline with tabs for Facts, Trivia History, and Comments */}
        <UserTimeline userId={userId} onUserClick={onUserClick} refreshKey={refreshKey} />

        {/* Custom Category Form Dialog */}
        <CustomCategoryForm
          open={customCategoryFormOpen}
          onClose={handleCloseCategoryForm}
          onSuccess={handleCategoryCreated}
        />

        {/* Score History Dialog */}
        {profileData && (
          <ScoreHistory
            open={scoreHistoryOpen}
            onClose={() => setScoreHistoryOpen(false)}
            scoringHistory={profileData.scoringHistory || []}
            totalScore={profileData.totalScore || 0}
          />
        )}
      </Box>
    </Fade>
  );
};

export default Profile;
