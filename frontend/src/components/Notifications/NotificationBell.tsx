// File: src/components/Notifications/NotificationBell.tsx
// Bell icon with unread badge — opens NotificationPanel on click.

import type { NotificationItem } from '@family-trivia/shared';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { Badge, IconButton } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onOpenNotifications, useNotifications } from '../../contexts/NotificationContext';
import { colors, tint } from '../../shared/design-system';
import NotificationPanel from './NotificationPanel';

interface Props {
  /** Called when a comment notification is clicked — navigate to that thread */
  onNotificationClick?: (item: NotificationItem) => void;
}

// The bell sits on the app header, so it uses the theme's on-header color.
const onHeader = `var(--ft-on-header, ${colors.onColor})`;

const NotificationBell: React.FC<Props> = ({ onNotificationClick }) => {
  const { unreadCount, notifications, markAllRead, markRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  // A toast's View opens the panel here.
  useEffect(() => onOpenNotifications(() => setAnchorEl(button.current)), []);

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleItemClick = useCallback(
    (item: NotificationItem) => {
      // Mark this thread as read
      if (item.contentType && item.contentId) {
        markRead(item.contentType, item.contentId);
      }
      handleClose();
      onNotificationClick?.(item);
    },
    [markRead, handleClose, onNotificationClick],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <>
      <IconButton
        ref={button}
        size="small"
        aria-label={unreadCount ? `Notifications, ${unreadCount} new` : 'Notifications'}
        onClick={handleOpen}
        sx={{
          color: tint(onHeader, 0.85),
          '&:hover': { color: onHeader },
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={9}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.55rem',
              minWidth: 16,
              height: 16,
              p: 0,
            },
          }}
        >
          <NotificationsNoneIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>
      <NotificationPanel
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        items={notifications}
        onMarkAllRead={handleMarkAllRead}
        onItemClick={handleItemClick}
      />
    </>
  );
};

export default NotificationBell;
