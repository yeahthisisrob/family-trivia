// File: src/components/Profile/IntegratedGroupDescription.tsx
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Typography,
  Button,
  TextField,
  Snackbar,
  Alert,
  useTheme,
  Collapse,
} from '@mui/material';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import AIGroupDescriptionSuggester from './AIGroupDescriptionSuggester';
import { GroupDescription, getGroupDescription, updateGroupDescription } from '../../api';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { getUserGroup } from '../../utils';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

// Initialize logger
const logger = createLogger('GroupDescription');

// Default description when a group doesn't have one
const DEFAULT_DESCRIPTION = 'A trusty group of trivia enthusiasts.';

interface IntegratedGroupDescriptionProps {
  userId: string;
  isCurrentUser: boolean;
}

const IntegratedGroupDescription: React.FC<IntegratedGroupDescriptionProps> = ({
  userId,
  isCurrentUser,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [description, setDescription] = useState<GroupDescription | null>(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [aiSuggesterOpen, setAiSuggesterOpen] = useState(false);

  // Track load attempts for retry logic
  const attemptsRef = useRef(0);
  const maxAttempts = 3;

  // Get the user's group ID
  const groupId = getUserGroup(userId) || 'Others';

  // Helper to handle errors and set appropriate UI state
  const handleError = useCallback((error: unknown, errorMessage: string) => {
    logger.error(errorMessage, error);

    setSnackbar({
      open: true,
      message: errorMessage,
      severity: 'error',
    });

    // Default description on error
    return {
      description: DEFAULT_DESCRIPTION,
      lastUpdated: new Date().toISOString(),
    };
  }, []);

  // Get description from context (already loaded by app-init) — no API call
  const { groupDescriptions: contextDescriptions } = useFamilyData();

  // Hydrate from context on mount or groupId change
  useEffect(() => {
    const fromContext = contextDescriptions[groupId];
    const desc: GroupDescription = fromContext
      ? typeof fromContext === 'string'
        ? { description: fromContext, lastUpdated: new Date().toISOString() }
        : fromContext
      : { description: DEFAULT_DESCRIPTION, lastUpdated: new Date().toISOString() };

    setDescription(desc);
    setEditedDescription(desc.description);
    setLoading(false);
  }, [groupId, contextDescriptions]);

  // Handle saving the edited description
  const handleSave = async () => {
    setLoading(true);
    try {
      logger.info(`Updating description for group ${groupId}`);
      const result = await updateGroupDescription(userId, groupId, editedDescription);

      if (result.success) {
        setDescription(result.description);
        setEditMode(false);
        setSnackbar({
          open: true,
          message: 'Group description updated successfully',
          severity: 'success',
        });
        logger.info(`Successfully updated description for group ${groupId}`);
      } else {
        throw new Error('Update returned unsuccessful status');
      }
    } catch (error) {
      handleError(error, 'Failed to update group description');
    } finally {
      setLoading(false);
    }
  };

  // Handle canceling the edit
  const handleCancel = () => {
    setEditedDescription(description?.description || '');
    setEditMode(false);
    logger.debug('Edit canceled');
  };

  // Handle accepting an AI-generated description
  const handleAcceptSuggestion = async (suggestion: string) => {
    try {
      setLoading(true);
      setEditedDescription(suggestion);
      logger.info(`Updating with AI suggestion for group ${groupId}`);

      const result = await updateGroupDescription(userId, groupId, suggestion);
      if (result.success) {
        setDescription(result.description);
        setAiSuggesterOpen(false);
        setSnackbar({
          open: true,
          message: 'AI-generated description applied successfully',
          severity: 'success',
        });
        logger.info('Successfully applied AI suggestion');
      } else {
        throw new Error('Update returned unsuccessful status');
      }
    } catch (error) {
      handleError(error, 'Failed to save AI-generated description');
    } finally {
      setLoading(false);
    }
  };

  // Format the timestamp for better readability
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      logger.warn('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  // Close the snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Display loading state
  if (loading) {
    return <LoadingDots mt={3} />;
  }

  // Handle missing description
  if (!description) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary" variant="body2">
          No group description available.
        </Typography>
      </Box>
    );
  }

  // Is description the default placeholder?
  const isDefaultDescription =
    description.description === DEFAULT_DESCRIPTION ||
    !description.description ||
    description.description.trim() === '';

  return (
    <>
      <Box
        sx={{
          p: 3,
          position: 'relative',
          bgcolor: 'background.paper',
        }}
      >
        {/* Display mode */}
        <Collapse in={!editMode}>
          <Box
            sx={{
              position: 'relative',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography
              variant="body1"
              sx={{
                pr: isCurrentUser ? 4 : 0,
                lineHeight: 1.6,
                fontStyle: isDefaultDescription ? 'italic' : 'normal',
                color: isDefaultDescription ? 'text.secondary' : 'text.primary',
              }}
            >
              {description.description || 'No group description yet.'}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 2,
                opacity: 0.8,
                fontStyle: 'italic',
              }}
            >
              {description.updatedBy && !isDefaultDescription
                ? `Last updated by ${description.updatedBy} on ${formatDate(description.lastUpdated)}`
                : !isDefaultDescription
                  ? `Last updated on ${formatDate(description.lastUpdated)}`
                  : ''}
            </Typography>

            {isCurrentUser && (
              <Button
                variant="outlined"
                size="small"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setEditMode(true)}
                sx={{
                  position: { xs: 'static', sm: 'absolute' },
                  top: 0,
                  right: 0,
                  minWidth: 'auto',
                  borderRadius: 20,
                  px: 1.5,
                  mt: { xs: 2, sm: 0 },
                  ml: { xs: 'auto', sm: 0 },
                  display: { xs: 'flex', sm: 'inline-flex' },
                  alignSelf: 'flex-end',
                  '&:hover': {
                    bgcolor: theme.palette.primary.light,
                    color: 'white',
                  },
                }}
              >
                Edit
              </Button>
            )}
          </Box>
        </Collapse>

        {/* Edit mode */}
        <Collapse in={editMode}>
          <Box sx={{ position: 'relative', pt: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value.slice(0, 120))}
              placeholder="Describe your group in 120 characters or less"
              variant="outlined"
              inputProps={{ maxLength: 120 }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused': {
                    boxShadow: '0 0 0 3px rgba(0,0,0,0.05)',
                  },
                },
              }}
            />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {editedDescription.length}/120 characters
                <Box component="span" sx={{ mx: 1, opacity: 0.5 }}>
                  •
                </Box>
                Last updated: {formatDate(description.lastUpdated)}
                {description.updatedBy ? ` by ${description.updatedBy}` : ''}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  onClick={handleCancel}
                  startIcon={<CloseIcon />}
                  sx={{ borderRadius: 20 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  onClick={() => setAiSuggesterOpen(true)}
                  startIcon={<AutoAwesomeIcon />}
                  sx={{ borderRadius: 20 }}
                >
                  Get Ideas
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="primary"
                  onClick={handleSave}
                  disabled={loading}
                  startIcon={loading ? <LoadingDots size={4} inline /> : <SaveIcon />}
                  sx={{ borderRadius: 20 }}
                >
                  Save
                </Button>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* Notification snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={handleCloseSnackbar}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* AI Description Suggester Dialog */}
      <AIGroupDescriptionSuggester
        userId={userId}
        open={aiSuggesterOpen}
        onClose={() => setAiSuggesterOpen(false)}
        onAccept={handleAcceptSuggestion}
      />
    </>
  );
};

export default IntegratedGroupDescription;
