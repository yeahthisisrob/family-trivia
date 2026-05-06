import Diversity3Icon from '@mui/icons-material/Diversity3';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import LogoutIcon from '@mui/icons-material/Logout';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import QuizIcon from '@mui/icons-material/Quiz';
import SettingsIcon from '@mui/icons-material/Settings';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  IconButton,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

import { ROUTES } from '../../hooks/useApp';
import { getUserColor, getUserInitials } from '../../utils';
import { NotificationBell } from '../Notifications';
import { LoadingDots } from '../ui/feedback';

import type { NotificationItem } from '@family-trivia/shared';

interface AppHeaderProps {
  selectedUser: string;
  onLogout: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
  loading?: boolean;
  onAvatarClick?: () => void;
  onNotificationClick?: (item: NotificationItem) => void;
}

const NAV_ITEMS = [
  { label: 'Home', icon: HomeRoundedIcon, path: ROUTES.HOME },
  { label: 'Trivia', icon: QuizIcon, path: ROUTES.PLAY },
  { label: 'Leaderboard', icon: EmojiEventsIcon, path: ROUTES.LEADERBOARD },
  { label: 'Family', icon: Diversity3Icon, path: ROUTES.FAMILY },
  { label: 'Photos', icon: PhotoLibraryRoundedIcon, path: ROUTES.PHOTOS },
  { label: 'Arcade', icon: SportsEsportsIcon, path: ROUTES.ARCADE },
];

const AppHeader: React.FC<AppHeaderProps> = ({
  selectedUser,
  onLogout,
  currentPath,
  onNavigate,
  isAdmin,
  loading,
  onAvatarClick,
  onNotificationClick,
}) => {
  const theme = useTheme();
  const userColor = getUserColor(selectedUser);

  // Use the green palette for consistent tones
  const headerBg = theme.palette.primary.dark;
  const activeBg = alpha('#fff', 0.15);
  const activeText = '#fff';
  const inactiveText = alpha('#c8e6c9', 0.85); // light green — readable but clearly inactive
  const inactiveIcon = alpha('#a5d6a7', 0.75); // soft green — not washed out

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: headerBg }}>
      {/* Top bar */}
      <Toolbar sx={{ minHeight: { xs: 48, sm: 54 }, px: { xs: 1.5, sm: 2 } }}>
        <Typography sx={{
          fontWeight: 800, fontSize: { xs: '1.05rem', sm: '1.15rem' },
          letterSpacing: 0.3, flex: 1, color: '#fff',
        }}>
          Family Trivia
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Avatar
            onClick={onAvatarClick}
            sx={{
              bgcolor: userColor, width: 30, height: 30,
              fontSize: '0.75rem', fontWeight: 700,
              cursor: onAvatarClick ? 'pointer' : 'default',
              border: `2px solid ${alpha('#fff', 0.25)}`,
              transition: 'all 0.15s',
              '&:hover': onAvatarClick ? { transform: 'scale(1.1)', borderColor: alpha('#fff', 0.5) } : {},
            }}
          >
            {getUserInitials(selectedUser)}
          </Avatar>
          <NotificationBell onNotificationClick={onNotificationClick} />
          {isAdmin && (
            <IconButton size="small" onClick={() => onNavigate(ROUTES.ADMIN)}
              sx={{ color: inactiveText, '&:hover': { color: '#fff' } }}>
              <SettingsIcon sx={{ fontSize: 19 }} />
            </IconButton>
          )}
          <IconButton size="small" onClick={onLogout}
            sx={{ color: alpha(inactiveText, 0.6), '&:hover': { color: '#fff' } }}>
            <LogoutIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      </Toolbar>

      {/* Nav tabs */}
      <Box sx={{
        display: 'flex',
        px: { xs: 0.75, sm: 1.5 },
        pb: 0.75,
        gap: { xs: 0.5, sm: 0.75 },
        bgcolor: alpha('#000', 0.08),
      }}>
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const isActive = currentPath === path;
          return (
            <Box
              key={path}
              onClick={() => onNavigate(path)}
              sx={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 0.2,
                py: { xs: 0.6, sm: 0.75 },
                mt: 0.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                bgcolor: isActive ? activeBg : 'transparent',
                '&:hover': !isActive ? { bgcolor: alpha('#fff', 0.07) } : {},
              }}
            >
              <Icon sx={{
                fontSize: { xs: 19, sm: 21 },
                color: isActive ? activeText : inactiveIcon,
                transition: 'color 0.2s',
              }} />
              <Typography sx={{
                fontSize: { xs: '0.6rem', sm: '0.65rem' },
                fontWeight: isActive ? 700 : 500,
                color: isActive ? activeText : inactiveText,
                letterSpacing: 0.2,
                transition: 'all 0.2s',
                lineHeight: 1,
              }}>
                {label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Loading dots */}
      {loading && (
        <Box sx={{ py: 0.5 }}>
          <LoadingDots size={5} color="rgba(255,255,255,0.6)" mt={0} />
        </Box>
      )}
    </AppBar>
  );
};

export default AppHeader;
