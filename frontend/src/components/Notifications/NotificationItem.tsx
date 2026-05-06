// File: src/components/Notifications/NotificationItem.tsx
// Single notification row — unread dot, avatar, message, time-ago.

import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PeopleIcon from '@mui/icons-material/People';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import StarIcon from '@mui/icons-material/Star';
import { Avatar, Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { formatDistance } from 'date-fns';
import React from 'react';

import { getUserColor, getUserInitials } from '../../utils';

import type { NotificationItem as NotificationItemType } from '@family-trivia/shared';

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
  const displayUser = isComment
    ? item.commentUserId
    : isHighScore
      ? item.scoreUserId
      : isFeud
        ? item.feudTargetName
        : isAlbumAdded
          ? item.albumAddedBy
          : item.newLeaderId;

  const GAME_LABELS: Record<string, string> = {
    tetris: 'Tetris', curling: 'Curling', 'slot-machine': 'Slots',
    snake: 'Snake', crossword: 'Crossword', blackjack: 'Blackjack', casino: 'Casino',
  };
  const gameLabel = item.gameId ? GAME_LABELS[item.gameId] ?? item.gameId : '';

  const contentLabel =
    item.contentType === 'fact' ? 'Fact'
    : item.contentType === 'trivia' ? 'Trivia'
    : item.contentType === 'album' ? 'Album'
    : item.contentType === 'arcade' ? 'Arcade'
    : '';

  const message = isComment
    ? `${item.commentUserId} commented${item.threadCommentCount && item.threadCommentCount > 1 ? ` (${item.threadCommentCount} new)` : ''}`
    : isHighScore
      ? `${item.scoreUserId} set a new ${gameLabel} high score!`
      : isFeud
        ? item.feudEventType === 'new_round'
          ? `New Family Feud! About ${item.feudTargetName}`
          : `Family Feud results are in! ${item.feudWinnerCount === 0 ? 'Nobody guessed right!' : `${item.feudWinnerCount} got it right`}`
        : isAlbumAdded
          ? `${item.albumAddedBy} shared a new album`
          : item.leaderType === 'group'
            ? `${item.newLeaderId} is now the top team!`
            : item.podiumPosition === 1
              ? `${item.newLeaderId} took the lead!`
              : item.podiumPosition === 2
                ? `${item.newLeaderId} moved into 2nd place!`
                : item.podiumPosition === 3
                  ? `${item.newLeaderId} cracked the top 3!`
                  : `${item.newLeaderId} took the lead!`;

  const detail = isComment
    ? item.commentText
    : isHighScore
      ? `Score: ${item.score?.toLocaleString()}${item.rank === 1 ? ' — #1 overall!' : item.rank ? ` — Rank #${item.rank}` : ''}`
      : isFeud
        ? item.feudEventType === 'new_round'
          ? `"${item.feudQuestion}"`
          : `About ${item.feudTargetName} — ${item.feudTotalGuesses} guesses`
        : isAlbumAdded
          ? item.albumName
          : undefined;

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
        <Avatar sx={{
          width: 28, height: 28, fontSize: '0.6rem', fontWeight: 700,
          bgcolor: getUserColor(displayUser), mt: 0.25,
        }}>
          {getUserInitials(displayUser)}
        </Avatar>
      ) : (
        <Avatar sx={{
          width: 28, height: 28, mt: 0.25,
          bgcolor: isHighScore ? '#FFD700'
            : isFeud ? '#9c27b0'
              : isAlbumAdded ? theme.palette.info.main
                : theme.palette.primary.main,
        }}>
          {isComment ? <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
            : isHighScore ? <StarIcon sx={{ fontSize: 14 }} />
            : isFeud ? <PeopleIcon sx={{ fontSize: 14 }} />
            : isAlbumAdded ? <PhotoLibraryRoundedIcon sx={{ fontSize: 14 }} />
            : <EmojiEventsIcon sx={{ fontSize: 14 }} />}
        </Avatar>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: '0.75rem',
          fontWeight: item.read ? 400 : 600,
          lineHeight: 1.3,
          color: theme.palette.text.primary,
        }}>
          {message}
        </Typography>
        {detail && (
          <Typography sx={{
            fontSize: '0.68rem',
            color: theme.palette.text.secondary,
            lineHeight: 1.3,
            mt: 0.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            &ldquo;{detail}&rdquo;
          </Typography>
        )}
        <Typography sx={{
          fontSize: '0.6rem',
          color: theme.palette.text.disabled,
          mt: 0.25,
        }}>
          {isComment && contentLabel && (
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
