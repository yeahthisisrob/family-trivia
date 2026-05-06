// File: src/components/Notifications/NotificationBell.tsx
// Bell icon with unread badge — opens NotificationPanel on click.

import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { Badge, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';

import NotificationPanel from './NotificationPanel';
import { useNotifications } from '../../contexts/NotificationContext';

import type { NotificationItem } from '@family-trivia/shared';

interface Props {
  /** Called when a comment notification is clicked — navigate to that thread */
  onNotificationClick?: (item: NotificationItem) => void;
}

const NotificationBell: React.FC<Props> = ({ onNotificationClick }) => {
  const { unreadCount, notifications, markAllRead, markRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleItemClick = useCallback((item: NotificationItem) => {
    // Mark this thread as read
    if (item.contentType && item.contentId) {
      markRead(item.contentType, item.contentId);
    }
    handleClose();
    onNotificationClick?.(item);
  }, [markRead, handleClose, onNotificationClick]);

  const handleMarkAllRead = useCallback(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        sx={{
          color: alpha('#c8e6c9', 0.85),
          '&:hover': { color: '#fff' },
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
