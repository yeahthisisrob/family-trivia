// File: components/CustomCategoryForm/index.tsx
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import StarsIcon from '@mui/icons-material/Stars';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
} from '@mui/material';
import React, { useState, useEffect } from 'react';

import FormFeedback from './FormFeedback';
import * as api from '../../api';
import { CustomCategory } from '../../api';
import appStrings from '../../constants/strings';
import { useTrivia } from '../../contexts/TriviaContext';
import { loadSession } from '../../session';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

interface CustomCategoryFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (category: CustomCategory) => void;
}

/**
 * A dialog for creating a custom trivia category via Bedrock AI.
 */
const CustomCategoryForm: React.FC<CustomCategoryFormProps> = ({ open, onClose, onSuccess }) => {
  // Initialize logger
  const logger = createLogger('CustomCategoryForm');

  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCategory, setGeneratedCategory] = useState<CustomCategory | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { invalidateCategories } = useTrivia();

  // Reset the form state when it's opened
  useEffect(() => {
    if (open) {
      setTopic('');
      setGeneratedCategory(null);
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const userId = loadSession();
      if (!userId) {
        setErrorMessage(appStrings.pleaseLoginToCreate);
        return;
      }

      // Generate a custom category based on the topic
      const category = await api.createCustomCategory(userId, topic.trim());
      setGeneratedCategory(category);
    } catch (err) {
      logger.error('Failed to generate category:', err);
      setErrorMessage(appStrings.failedToGenerate);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!generatedCategory) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const userId = loadSession();
      if (!userId) {
        setErrorMessage(appStrings.pleaseLoginToSave);
        return;
      }

      // Save the category to the user's profile
      await api.submitCustomCategory(userId, generatedCategory);

      // Set success message
      setSuccessMessage(appStrings.customCategoryCreationSuccess);

      // Invalidate categories cache to force refresh in all components
      invalidateCategories();

      // Short delay to show success message
      setTimeout(() => {
        // Call onSuccess callback with the new category
        onSuccess(generatedCategory);
        // Close the dialog
        onClose();
      }, 1000);
    } catch (err) {
      logger.error('Failed to save category', { err });
      setErrorMessage(appStrings.failedToSave);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setGeneratedCategory(null);
    setTopic('');
    setErrorMessage('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      style={{ zIndex: 1500 }} // Ensure a high z-index
      disableEnforceFocus={false} // Ensure focus is trapped in the modal
      disableAutoFocus={false} // Enable auto focus on the modal
      disableRestoreFocus={false} // Restore focus after the modal is closed
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StarsIcon color="secondary" />
        {appStrings.createYourCustomCategory}
      </DialogTitle>

      <DialogContent>
        {/* Error feedback */}
        {errorMessage && (
          <FormFeedback
            message={errorMessage}
            severity="error"
            onDismiss={() => setErrorMessage('')}
            sx={{ mb: 2 }}
          />
        )}

        {/* Success feedback */}
        {successMessage && (
          <FormFeedback message={successMessage} severity="success" sx={{ mb: 2 }} />
        )}

        {!generatedCategory ? (
          <>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {appStrings.passionateAbout}
            </Typography>

            <TextField
              label={appStrings.yourTopic}
              placeholder={appStrings.topicPlaceholder}
              fullWidth
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              color="secondary"
              startIcon={<AutoFixHighIcon />}
              disabled={loading || !topic.trim()}
              onClick={handleGenerate}
              fullWidth
            >
              {loading ? (
                <LoadingDots size={5} inline />
              ) : (
                appStrings.generateCategory
              )}
            </Button>
          </>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              {appStrings.hereIsYourCategory}
            </Alert>

            <Box
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'secondary.main',
                borderRadius: 2,
                bgcolor: 'background.paper',
                boxShadow: 1,
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <StarsIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6" color="secondary.main">
                  {generatedCategory.title}
                </Typography>
                <Chip
                  label="NEW"
                  color="error"
                  size="small"
                  sx={{ ml: 'auto', fontSize: '0.65rem', height: 20 }}
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                {generatedCategory.description}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="outlined" onClick={handleReset} disabled={loading}>
                {appStrings.tryDifferentTopic}
              </Button>

              <Button
                variant="contained"
                color="secondary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <LoadingDots size={5} inline />
                ) : (
                  appStrings.useThisCategory
                )}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomCategoryForm;
