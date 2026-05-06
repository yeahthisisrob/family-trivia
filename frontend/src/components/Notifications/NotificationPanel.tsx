// File: src/components/Notifications/NotificationPanel.tsx
// Dropdown panel listing notification items.

import DoneAllIcon from '@mui/icons-material/DoneAll';
import { Box, Button, Divider, Popover, Typography, useTheme } from '@mui/material';
import React from 'react';

import NotificationItem from './NotificationItem';

import type { NotificationItem as NotificationItemType } from '@family-trivia/shared';

interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  items: NotificationItemType[];
  onMarkAllRead: () => void;
  onItemClick?: (item: NotificationItemType) => void;
}

const NotificationPanel: React.FC<Props> = ({
  anchorEl, open, onClose, items, onMarkAllRead, onItemClick,
}) => {
  const theme = useTheme();
  const unreadCount = items.filter(i => !i.read).length;

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            width: 320,
            maxHeight: 420,
            borderRadius: 2,
            mt: 0.5,
            boxShadow: theme.shadows[8],
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 1, borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
          Notifications
          {unreadCount > 0 && (
            <Box component="span" sx={{
              ml: 0.75, fontSize: '0.65rem', fontWeight: 600,
              color: theme.palette.primary.main,
            }}>
              {unreadCount} new
            </Box>
          )}
        </Typography>
        {unreadCount > 0 && (
          <Button
            size="small"
            startIcon={<DoneAllIcon sx={{ fontSize: '14px !important' }} />}
            onClick={onMarkAllRead}
            sx={{ fontSize: '0.65rem', textTransform: 'none', py: 0.25 }}
          >
            Mark all read
          </Button>
        )}
      </Box>

      {/* Items */}
      <Box sx={{ overflowY: 'auto', maxHeight: 360 }}>
        {items.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{
              fontSize: '0.8rem', color: theme.palette.text.disabled,
            }}>
              You&apos;re all caught up!
            </Typography>
          </Box>
        ) : (
          items.map((item, i) => (
            <React.Fragment key={item.id}>
              {i > 0 && <Divider sx={{ opacity: 0.4 }} />}
              <NotificationItem
                item={item}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            </React.Fragment>
          ))
        )}
      </Box>
    </Popover>
  );
};

export default NotificationPanel;
