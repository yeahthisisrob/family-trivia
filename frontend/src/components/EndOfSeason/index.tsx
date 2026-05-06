import { Celebration, CheckCircle, Schedule } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Fade,
  Paper,
  Typography,
} from '@mui/material';
import React from 'react';

import { Season } from '../../api/modules/celebrations';

interface EndOfSeasonProps {
  open: boolean;
  onDismiss: () => void;
  personalMessage?: string;
  lastSeason?: Season | null;
  questionsBehind?: number;
  onCatchUp?: () => void;
  factsBehind?: number;
  onCatchUpFacts?: () => void;
}

export const EndOfSeason: React.FC<EndOfSeasonProps> = ({
  open,
  onDismiss,
  personalMessage = '',
  lastSeason,
  questionsBehind = 0,
  onCatchUp,
  factsBehind = 0,
  onCatchUpFacts,
}) => {
  const seasonLabel = lastSeason?.name || 'Season';
  const seasonDates =
    lastSeason?.startDate && lastSeason?.endDate
      ? `${formatDate(lastSeason.startDate)} — ${formatDate(lastSeason.endDate)}`
      : null;

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      fullWidth
      maxWidth="sm"
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 400 }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Container maxWidth="md">
      <Paper
        elevation={3}
        sx={{
          p: 4,
          mt: 4,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Celebration sx={{ fontSize: 48, mr: 2 }} />
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold' }}>
                {seasonLabel} Complete!
              </Typography>
              {seasonDates && (
                <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
                  {seasonDates}
                </Typography>
              )}
            </Box>
          </Box>

          <Typography variant="h6" sx={{ mb: 3, opacity: 0.95 }}>
            The trivia season has ended. Great job everyone!
          </Typography>

          {personalMessage && (
            <>
              <Divider sx={{ my: 3, backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {personalMessage}
                </Typography>
              </Paper>
            </>
          )}
        </Box>
      </Paper>

      {/* Catch-up sections */}
      {(questionsBehind > 0 || factsBehind > 0) && (
        <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
            Catch Up Available
          </Typography>

          {questionsBehind > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Schedule sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Trivia Questions</Typography>
                <Chip
                  label={`${questionsBehind} behind`}
                  color="warning"
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                You can still answer missed trivia questions from {seasonLabel.toLowerCase()}.
              </Typography>
              <Button
                variant="contained"
                onClick={onCatchUp}
                startIcon={<CheckCircle />}
                color="primary"
              >
                Catch Up on Trivia
              </Button>
            </Box>
          )}

          {factsBehind > 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Schedule sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Daily Facts</Typography>
                <Chip label={`${factsBehind} behind`} color="info" size="small" sx={{ ml: 2 }} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                You can still submit missed daily facts from {seasonLabel.toLowerCase()}.
              </Typography>
              <Button
                variant="contained"
                onClick={onCatchUpFacts}
                startIcon={<CheckCircle />}
                color="secondary"
              >
                Catch Up on Facts
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {/* Season highlights */}
      <Paper elevation={1} sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {seasonLabel} Highlights
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Check the leaderboard and your profile for your season statistics!
        </Typography>
      </Paper>
    </Container>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onDismiss} fullWidth>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
