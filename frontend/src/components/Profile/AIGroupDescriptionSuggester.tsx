// File: src/components/Profile/AIGroupDescriptionSuggester.tsx
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MagicIcon from '@mui/icons-material/AutoFixHigh';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState, useCallback, useEffect } from 'react';

import { GroupDescriptionSuggestion, suggestGroupDescription } from '../../api';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

interface AIGroupDescriptionSuggesterProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  onAccept: (description: string) => Promise<void>;
}

// Initialize logger
const logger = createLogger('AIGroupDescriptionSuggester');

const AIGroupDescriptionSuggester: React.FC<AIGroupDescriptionSuggesterProps> = ({
  userId,
  open,
  onClose,
  onAccept,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<GroupDescriptionSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptingDescription, setAcceptingDescription] = useState(false);

  // Generate a new suggestion
  const generateSuggestion = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await suggestGroupDescription(userId);
      setSuggestion(result);
    } catch (err) {
      logger.error('Failed to generate description suggestion:', err);
      setError('Could not generate a suggestion at this time. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Accept the suggestion
  const handleAccept = async () => {
    if (!suggestion) return;

    setAcceptingDescription(true);
    try {
      await onAccept(suggestion.suggestion);
      onClose();
    } catch (err) {
      logger.error('Failed to accept suggestion:', err);
      setError('Failed to update the description. Please try again.');
    } finally {
      setAcceptingDescription(false);
    }
  };

  // Generate a suggestion when the dialog opens
  useEffect(() => {
    if (open) {
      generateSuggestion();
    } else {
      // Reset state when dialog closes
      setSuggestion(null);
      setError(null);
    }
  }, [open, generateSuggestion]);

  // Determine character count color based on length
  const getCharCountColor = (text: string) => {
    const length = text?.length || 0;
    if (length > 110) return theme.palette.error.main;
    if (length > 90) return theme.palette.warning.main;
    return theme.palette.text.secondary;
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: theme.palette.secondary.main,
          color: theme.palette.secondary.contrastText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AutoAwesomeIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            AI Description Assistant
          </Typography>
        </Box>
        <IconButton edge="end" color="inherit" onClick={onClose} disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <LoadingDots mt={0} />
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              Generating a creative description for your group...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error" paragraph>
              {error}
            </Typography>
            <Button variant="contained" onClick={generateSuggestion} startIcon={<MagicIcon />}>
              Try Again
            </Button>
          </Box>
        ) : suggestion ? (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Current Description:
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  fontStyle: suggestion.currentDescription ? 'normal' : 'italic',
                  color: suggestion.currentDescription ? 'text.primary' : 'text.secondary',
                }}
              >
                {suggestion.currentDescription || 'No description set'}
              </Paper>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: 'secondary.main',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <AutoAwesomeIcon sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                  AI-Generated Suggestion:
                </Typography>
                <Tooltip title="Generate another suggestion">
                  <IconButton
                    size="small"
                    onClick={generateSuggestion}
                    color="secondary"
                    disabled={loading}
                  >
                    <MagicIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  borderColor: 'secondary.main',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.05)',
                  position: 'relative',
                  fontWeight: 'medium',
                }}
              >
                {suggestion.suggestion}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -8,
                    right: 8,
                    bgcolor: 'background.paper',
                    px: 1,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    fontSize: '0.7rem',
                    color: getCharCountColor(suggestion.suggestion),
                  }}
                >
                  {suggestion.suggestion.length}/120
                </Box>
              </Paper>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              This suggestion is based on your group info, members, and activity in the game. You
              can accept it as-is or generate new suggestions.
            </Typography>
          </>
        ) : null}
      </DialogContent>

      {suggestion && !loading && !error && (
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button variant="outlined" onClick={onClose} startIcon={<CloseIcon />}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleAccept}
            disabled={acceptingDescription}
            startIcon={acceptingDescription ? <LoadingDots size={4} inline /> : <SaveIcon />}
          >
            Use This Description
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AIGroupDescriptionSuggester;
