// File: src/components/Notifications/NotificationItem.tsx
// Single notification row — unread dot, avatar, message, time-ago.

import type { NotificationItem as NotificationItemType } from '@family-trivia/shared';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PeopleIcon from '@mui/icons-material/People';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import StarIcon from '@mui/icons-material/Star';
import { Avatar, Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { formatDistance } from 'date-fns';
import type React from 'react';
import { PersonAvatar } from '../../entities/person';
import { colors } from '../../shared/design-system';
import { getUserColor, getUserInitials } from '../../utils';
import { notificationDetail, notificationMessage } from './notificationText';

interface Props {
  item: NotificationItemType;
  onClick?: () => void;
}

const NotificationItem: React.FC<Props> = ({ item, onClick }) => {
  const theme = useTheme();

  const timeAgo = (() => {
    try {
      return formatDistance(new Date(item.timestamp), new Date(), { addSuffix: true });
    } catch {
      return '';
    }
  })();

  const isComment = item.type === 'comment';
  const isHighScore = item.type === 'high_score';
  const isFeud = item.type === 'family_feud';
  const isAlbumAdded = item.type === 'album_added';
  const isReaction = item.type === 'reaction';
  const displayUser = isComment
    ? item.commentUserId
    : isReaction
      ? item.reactionUserId
      : isHighScore
        ? item.scoreUserId
        : isFeud
          ? item.feudTargetName
          : isAlbumAdded
            ? item.albumAddedBy
            : item.newLeaderId;

  const contentLabel =
    item.contentType === 'fact'
      ? 'Fact'
      : item.contentType === 'trivia'
        ? 'Trivia'
        : item.contentType === 'album'
          ? 'Album'
          : item.contentType === 'arcade'
            ? 'Arcade'
            : '';

  const message = notificationMessage(item);
  const detail = notificationDetail(item);

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.5,
        py: 1,
        cursor: onClick ? 'pointer' : 'default',
        bgcolor: item.read ? 'transparent' : alpha(theme.palette.primary.main, 0.04),
        borderLeft: item.read ? 'none' : `3px solid ${theme.palette.primary.main}`,
        transition: 'background 0.15s',
        '&:hover': onClick ? { bgcolor: alpha(theme.palette.action.hover, 0.06) } : {},
      }}
    >
      {/* Avatar or icon */}
      {displayUser ? (
        <PersonAvatar
          personId={displayUser}
          sx={{
            width: 28,
            height: 28,
            fontSize: '0.6rem',
            fontWeight: 700,
            bgcolor: getUserColor(displayUser),
            mt: 0.25,
          }}
        >
          {getUserInitials(displayUser)}
        </PersonAvatar>
      ) : (
        <Avatar
          sx={{
            width: 28,
            height: 28,
            mt: 0.25,
            bgcolor: isHighScore
              ? colors.medal.gold
              : isFeud
                ? colors.accent.purple
                : isAlbumAdded
                  ? theme.palette.info.main
                  : theme.palette.primary.main,
          }}
        >
          {isComment ? (
            <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
          ) : isHighScore ? (
            <StarIcon sx={{ fontSize: 14 }} />
          ) : isFeud ? (
            <PeopleIcon sx={{ fontSize: 14 }} />
          ) : isAlbumAdded ? (
            <PhotoLibraryRoundedIcon sx={{ fontSize: 14 }} />
          ) : (
            <EmojiEventsIcon sx={{ fontSize: 14 }} />
          )}
        </Avatar>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: item.read ? 400 : 600,
            lineHeight: 1.3,
            color: theme.palette.text.primary,
          }}
        >
          {message}
        </Typography>
        {detail && (
          <Typography
            sx={{
              fontSize: '0.68rem',
              color: theme.palette.text.secondary,
              lineHeight: 1.3,
              mt: 0.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            &ldquo;{detail}&rdquo;
          </Typography>
        )}
        <Typography
          sx={{
            fontSize: '0.6rem',
            color: theme.palette.text.disabled,
            mt: 0.25,
          }}
        >
          {(isComment || isReaction) && contentLabel && (
            <Box component="span" sx={{ mr: 0.5 }}>
              {contentLabel}
            </Box>
          )}
          {timeAgo}
        </Typography>
      </Box>
    </Box>
  );
};

export default NotificationItem;
