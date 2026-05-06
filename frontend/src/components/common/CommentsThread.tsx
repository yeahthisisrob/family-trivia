// File: src/components/common/CommentsThread.tsx
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import {
  Box,
  Typography,
  Avatar,
  TextField,
  Collapse,
  Grow,
  IconButton,
  useTheme,
  InputAdornment,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { formatDistance, parseISO } from 'date-fns';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useNotifications } from '../../contexts/NotificationContext';
import { useTimeline } from '../../contexts/TimelineContext';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

import type { Comment, CommentContentType } from '../../api';

const logger = createLogger('CommentsThread');

interface CommentsThreadProps {
  contentId: string;
  contentType: CommentContentType;
  currentUserId: string;
  getUserColor: (userId: string) => string;
  getUserInitials: (userId: string) => string;
  textOverrides?: {
    emptyText?: string;
    placeholderText?: string;
  };
}

const MAX_COMMENT_LENGTH = 100;

const CommentsThread: React.FC<CommentsThreadProps> = ({
  contentId,
  contentType,
  currentUserId,
  getUserColor,
  getUserInitials,
  textOverrides = {},
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [mainText, setMainText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const threadContainerRef = useRef<HTMLDivElement>(null);

  const {
    getComments,
    fetchComments,
    addComment,
    commentsLoading: loading,
    commentCounts,
    commentCommenters,
  } = useTimeline();
  const { markRead } = useNotifications();
  const comments = getComments(contentType, contentId);

  useEffect(() => {
    if (expanded) {
      fetchComments(contentType, contentId);
      // Mark this thread as read for notification tracking
      markRead(contentType, contentId);
    }
  }, [expanded, contentType, contentId, fetchComments, markRead]);

  // Auto-focus main input when expanding
  useEffect(() => {
    if (expanded && mainInputRef.current) {
      // Small delay to let Collapse animation start
      const t = setTimeout(() => mainInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [expanded]);

  // Auto-focus reply input
  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      replyInputRef.current.focus();
      replyInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [replyingTo]);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyText('');
    // Return focus to main input
    mainInputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const handleSubmit = async (parentId?: string) => {
    const text = parentId ? replyText : mainText;
    if (!text.trim() || text.length > MAX_COMMENT_LENGTH) return;
    setSubmitting(true);
    try {
      await addComment(contentType, contentId, currentUserId, text.trim(), parentId);
      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
        // Focus main input after reply
        mainInputRef.current?.focus();
      } else {
        setMainText('');
        // Keep focus in main input for rapid comments
        mainInputRef.current?.focus();
      }
      // Auto-scroll to show new comment
      scrollToBottom();
    } catch (error) {
      logger.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyClick = useCallback((commentId: string) => {
    if (replyingTo === commentId) {
      cancelReply();
    } else {
      setReplyingTo(commentId);
      setReplyText('');
    }
  }, [replyingTo, cancelReply]);

  const topLevelComments = comments.filter((c) => c && !c.parentId);
  const getReplies = (id: string) => comments.filter((c) => c && c.parentId === id);
  const commentCount = comments.length || (commentCounts.get(`${contentType}:${contentId}`) ?? 0);
  const replyTargetComment = replyingTo ? comments.find((c) => c.id === replyingTo) : null;

  const { placeholderText = 'Write a comment...' } = textOverrides;

  // Render helper (not a component — avoids remount on every keystroke)
  const renderInput = (
    text: string,
    setText: (v: string) => void,
    onSubmit: () => void,
    opts?: {
      placeholder?: string;
      small?: boolean;
      inputRef?: React.Ref<HTMLInputElement>;
      replyContext?: { userId: string; onCancel: () => void } | null;
    },
  ) => {
    const placeholder = opts?.placeholder ?? placeholderText;
    const small = opts?.small ?? false;

    return (
      <Box>
        {/* Reply indicator bar */}
        {opts?.replyContext && (
          <Grow in>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                borderLeft: `3px solid ${theme.palette.primary.main}`,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderRadius: '0 8px 8px 0',
                px: 1.5,
                py: 0.4,
                mb: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: theme.palette.primary.main,
                  fontWeight: 600,
                  flex: 1,
                }}
              >
                Replying to {opts.replyContext.userId}
              </Typography>
              <IconButton
                size="small"
                onClick={opts.replyContext.onCancel}
                sx={{ p: 0.25, color: theme.palette.text.secondary }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          </Grow>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
          <Avatar sx={{
            width: small ? 20 : 26, height: small ? 20 : 26,
            fontSize: small ? '0.5rem' : '0.6rem', fontWeight: 700,
            bgcolor: getUserColor(currentUserId),
          }}>
            {getUserInitials(currentUserId)}
          </Avatar>
          <TextField
            size="small"
            fullWidth
            placeholder={placeholder}
            value={text}
            inputRef={opts?.inputRef}
            onChange={(e) => {
              if (e.target.value.length <= MAX_COMMENT_LENGTH) {
                setText(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    disabled={!text.trim() || submitting}
                    onClick={onSubmit}
                    sx={{ color: theme.palette.primary.main, p: 0.5 }}
                  >
                    {submitting ? <LoadingDots size={3} inline /> : <SendIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3, py: 0,
                fontSize: small ? '0.72rem' : '0.78rem',
                bgcolor: alpha(theme.palette.action.hover, 0.04),
                '& fieldset': { borderColor: alpha(theme.palette.divider, 0.12) },
                '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.3) },
              },
            }}
          />
        </Box>
        {text.length > MAX_COMMENT_LENGTH * 0.8 && (
          <Typography sx={{
            fontSize: '0.5rem', textAlign: 'right', mt: 0.15,
            color: text.length >= MAX_COMMENT_LENGTH ? theme.palette.error.main : theme.palette.text.disabled,
          }}>
            {text.length}/{MAX_COMMENT_LENGTH}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ mt: 0.75 }}>
      {/* Trigger bar */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: 'pointer',
          py: 0.5,
          px: 1,
          borderRadius: 2,
          bgcolor:
            commentCount > 0 ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          border:
            commentCount > 0
              ? `1px solid ${alpha(theme.palette.primary.main, 0.12)}`
              : `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          transition: 'all 0.15s',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
        }}
      >
        <ChatBubbleOutlineIcon
          sx={{
            fontSize: 15,
            color:
              commentCount > 0
                ? theme.palette.primary.main
                : theme.palette.text.disabled,
          }}
        />
        <Typography
          sx={{
            fontSize: '0.72rem',
            flex: 1,
            color:
              commentCount > 0
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
            fontWeight: commentCount > 0 ? 600 : 400,
          }}
        >
          {commentCount > 0
            ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
            : 'Add a comment'}
        </Typography>
        {commentCount > 0 && !expanded && (
          <Box sx={{ display: 'flex', gap: 0 }}>
            {(
              topLevelComments.length > 0
                ? [...new Set(topLevelComments.map((c) => c.userId))].slice(0, 3)
                : commentCommenters.get(`${contentType}:${contentId}`) || []
            ).map((uid, i) => (
                <Avatar
                  key={uid}
                  sx={{
                    width: 18,
                    height: 18,
                    fontSize: '0.45rem',
                    fontWeight: 700,
                    bgcolor: getUserColor(uid),
                    ml: i > 0 ? -0.5 : 0,
                    border: `1.5px solid ${theme.palette.background.paper}`,
                    zIndex: 3 - i,
                  }}
                >
                  {getUserInitials(uid)}
                </Avatar>
              ))}
          </Box>
        )}
      </Box>

      {/* Expanded thread */}
      <Collapse in={expanded} timeout={250}>
        <Box
          ref={threadContainerRef}
          sx={{
            pt: 1,
            pl: 0.5,
            maxHeight: 400,
            overflowY: 'auto',
            scrollBehavior: 'smooth',
            // Subtle scrollbar
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(theme.palette.text.disabled, 0.2),
              borderRadius: 2,
            },
          }}
        >
          {loading ? (
            <LoadingDots mt={0} />
          ) : (
            <>
              {topLevelComments.length > 0 ? (
                topLevelComments.map((comment) => (
                  <CommentBubble
                    key={comment.id}
                    comment={comment}
                    replies={getReplies(comment.id)}
                    getUserColor={getUserColor}
                    getUserInitials={getUserInitials}
                    currentUserId={currentUserId}
                    isReplying={replyingTo === comment.id}
                    onReply={() => handleReplyClick(comment.id)}
                    replyInput={
                      replyingTo === comment.id
                        ? renderInput(
                            replyText,
                            setReplyText,
                            () => handleSubmit(comment.id),
                            {
                              placeholder: 'Reply...',
                              small: true,
                              inputRef: replyInputRef,
                              replyContext: replyTargetComment
                                ? {
                                    userId: replyTargetComment.userId,
                                    onCancel: cancelReply,
                                  }
                                : null,
                            },
                          )
                        : null
                    }
                  />
                ))
              ) : (
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: theme.palette.text.disabled,
                    py: 1,
                    textAlign: 'center',
                  }}
                >
                  No comments yet
                </Typography>
              )}

              {/* Scroll anchor */}
              <div ref={threadEndRef} />

              {/* Main input — always visible at bottom */}
              <Box
                sx={{
                  position: 'sticky',
                  bottom: 0,
                  pt: 0.75,
                  pb: 0.5,
                  bgcolor: 'inherit',
                }}
              >
                {renderInput(mainText, setMainText, () => handleSubmit(), {
                  inputRef: mainInputRef,
                })}
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

// ── Comment bubble ──────────────────────────────────────────────

interface CommentBubbleProps {
  comment: Comment;
  replies: Comment[];
  getUserColor: (userId: string) => string;
  getUserInitials: (userId: string) => string;
  currentUserId: string;
  isReplying: boolean;
  onReply: () => void;
  replyInput: React.ReactNode;
}

const CommentBubble: React.FC<CommentBubbleProps> = ({
  comment,
  replies,
  getUserColor,
  getUserInitials,
  currentUserId,
  isReplying,
  onReply,
  replyInput,
}) => {
  const theme = useTheme();
  const [showReplies, setShowReplies] = useState(true);
  const isOwn = comment.userId === currentUserId;

  const timeAgo = (ts: string) => {
    try {
      return formatDistance(parseISO(ts), new Date(), { addSuffix: true });
    } catch {
      return '';
    }
  };

  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
        <Avatar
          sx={{
            width: 26,
            height: 26,
            fontSize: '0.55rem',
            fontWeight: 700,
            mt: 0.15,
            bgcolor: getUserColor(comment.userId),
          }}
        >
          {getUserInitials(comment.userId)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: 'inline-block',
              bgcolor: isOwn
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.action.hover, 0.06),
              borderRadius: 2.5,
              px: 1.25,
              py: 0.6,
              maxWidth: '100%',
            }}
          >
            <Typography
              sx={{ fontWeight: 700, fontSize: '0.65rem', lineHeight: 1.2, mb: 0.1 }}
            >
              {comment.userId}
            </Typography>
            <Typography
              sx={{ fontSize: '0.78rem', lineHeight: 1.4, wordBreak: 'break-word' }}
            >
              {comment.text}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              mt: 0.15,
              pl: 0.5,
            }}
          >
            <Typography
              sx={{ fontSize: '0.52rem', color: theme.palette.text.disabled }}
            >
              {timeAgo(comment.timestamp)}
            </Typography>
            <Typography
              onClick={onReply}
              sx={{
                fontSize: '0.55rem',
                fontWeight: 600,
                color: isReplying
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary,
                cursor: 'pointer',
                '&:hover': { color: theme.palette.primary.main },
              }}
            >
              Reply
            </Typography>
            {replies.length > 0 && (
              <Typography
                onClick={() => setShowReplies(!showReplies)}
                sx={{
                  fontSize: '0.55rem',
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  cursor: 'pointer',
                  '&:hover': { color: theme.palette.primary.main },
                }}
              >
                {showReplies
                  ? 'Hide'
                  : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Collapse in={showReplies}>
        <Box sx={{ pl: 4, mt: 0.25 }}>
          {replies.map((reply) => (
            <Box
              key={reply.id}
              sx={{
                display: 'flex',
                gap: 0.6,
                alignItems: 'flex-start',
                mb: 0.75,
              }}
            >
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  fontSize: '0.45rem',
                  fontWeight: 700,
                  mt: 0.15,
                  bgcolor: getUserColor(reply.userId),
                }}
              >
                {getUserInitials(reply.userId)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'inline-block',
                    bgcolor:
                      reply.userId === currentUserId
                        ? alpha(theme.palette.primary.main, 0.06)
                        : alpha(theme.palette.action.hover, 0.04),
                    borderRadius: 2,
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.58rem',
                      lineHeight: 1.2,
                      mb: 0.05,
                    }}
                  >
                    {reply.userId}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}
                  >
                    {reply.text}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.48rem',
                    color: theme.palette.text.disabled,
                    mt: 0.1,
                    pl: 0.5,
                  }}
                >
                  {timeAgo(reply.timestamp)}
                </Typography>
              </Box>
            </Box>
          ))}
          {replyInput && <Box sx={{ mt: 0.25, mb: 0.25 }}>{replyInput}</Box>}
        </Box>
      </Collapse>
    </Box>
  );
};

export default CommentsThread;
