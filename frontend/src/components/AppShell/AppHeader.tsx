import type { NotificationItem } from '@family-trivia/shared';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import LogoutIcon from '@mui/icons-material/Logout';
import QuizIcon from '@mui/icons-material/Quiz';
import SettingsIcon from '@mui/icons-material/Settings';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { AppBar, Avatar, Box, IconButton, Toolbar, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import { appearanceApi } from '../../entities/appearance';
import { useFeatures } from '../../entities/settings';
import { CircleSwitcher } from '../../features/circles';
import { ROUTES } from '../../hooks/useApp';
import { colors, tint } from '../../shared/design-system';
import { AppearanceMenu } from '../../shared/design-system/components/AppearanceMenu';
import { getUserColor, getUserInitials } from '../../utils';
import { NotificationBell } from '../Notifications';
import { LoadingDots } from '../ui/feedback';

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
  { label: 'Family', icon: Diversity3Icon, path: ROUTES.FAMILY },
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
  const features = useFeatures();
  const userColor = getUserColor(selectedUser);

  // The app bar takes its colors from the active theme (themes/registry.ts):
  // the header may be a gradient, and text on it is the theme's onHeader.
  const headerBg = colors.surface.header;
  const onHeader = `var(--ft-on-header, ${colors.onColor})`;
  const activeBg = tint(onHeader, 0.15);
  const activeText = onHeader;
  const inactiveText = tint(onHeader, 0.78);
  const inactiveIcon = tint(onHeader, 0.68);

  return (
    <AppBar position="sticky" elevation={0} sx={{ background: headerBg, color: onHeader }}>
      {/* Top bar */}
      <Toolbar sx={{ minHeight: { xs: 48, sm: 54 }, px: { xs: 1.5, sm: 2 } }}>
        <CircleSwitcher fallbackTitle="Family Trivia" color={onHeader} mutedColor={inactiveText} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Avatar
            onClick={onAvatarClick}
            sx={{
              bgcolor: userColor,
              width: 30,
              height: 30,
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: onAvatarClick ? 'pointer' : 'default',
              border: `2px solid ${tint(onHeader, 0.25)}`,
              transition: 'all 0.15s',
              '&:hover': onAvatarClick
                ? { transform: 'scale(1.1)', borderColor: tint(onHeader, 0.5) }
                : {},
            }}
          >
            {getUserInitials(selectedUser)}
          </Avatar>
          <NotificationBell onNotificationClick={onNotificationClick} />
          <AppearanceMenu
            sx={{ color: inactiveText, '&:hover': { color: onHeader } }}
            onSetFamilyDefault={
              isAdmin
                ? async (themeId) => {
                    await appearanceApi.setFamilyTheme(themeId);
                  }
                : undefined
            }
          />
          {isAdmin && (
            <IconButton
              size="small"
              onClick={() => onNavigate(ROUTES.ADMIN)}
              sx={{ color: inactiveText, '&:hover': { color: onHeader } }}
            >
              <SettingsIcon sx={{ fontSize: 19 }} />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={onLogout}
            sx={{ color: tint(onHeader, 0.5), '&:hover': { color: onHeader } }}
          >
            <LogoutIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      </Toolbar>

      {/* Nav tabs */}
      <Box
        sx={{
          display: 'flex',
          px: { xs: 0.75, sm: 1.5 },
          pb: 0.75,
          gap: { xs: 0.5, sm: 0.75 },
          bgcolor: alpha(colors.scrim, 0.08),
        }}
      >
        {NAV_ITEMS.filter((n) => n.path !== ROUTES.ARCADE || features.arcade).map(
          ({ label, icon: Icon, path }) => {
            // The leaderboard lives inside the Trivia tab.
            const isActive =
              currentPath === path || (path === ROUTES.PLAY && currentPath === ROUTES.LEADERBOARD);
            return (
              <Box
                key={path}
                onClick={() => onNavigate(path)}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.2,
                  py: { xs: 0.6, sm: 0.75 },
                  mt: 0.5,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  bgcolor: isActive ? activeBg : 'transparent',
                  '&:hover': !isActive ? { bgcolor: tint(onHeader, 0.07) } : {},
                }}
              >
                <Icon
                  sx={{
                    fontSize: { xs: 19, sm: 21 },
                    color: isActive ? activeText : inactiveIcon,
                    transition: 'color 0.2s',
                  }}
                />
                <Typography
                  sx={{
                    fontSize: { xs: '0.6rem', sm: '0.65rem' },
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? activeText : inactiveText,
                    letterSpacing: 0.2,
                    transition: 'all 0.2s',
                    lineHeight: 1,
                  }}
                >
                  {label}
                </Typography>
              </Box>
            );
          },
        )}
      </Box>

      {/* Loading dots */}
      {loading && (
        <Box sx={{ py: 0.5 }}>
          <LoadingDots size={5} color={tint(onHeader, 0.6)} mt={0} />
        </Box>
      )}
    </AppBar>
  );
};

export default AppHeader;
