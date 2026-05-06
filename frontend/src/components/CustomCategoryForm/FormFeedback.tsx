// File: src/components/CustomCategoryForm/FormFeedback.tsx
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Paper, Typography, IconButton, SxProps, Theme } from '@mui/material';
import React from 'react';

interface FormFeedbackProps {
  message: string;
  severity?: 'error' | 'warning' | 'info' | 'success';
  onDismiss?: () => void;
  sx?: SxProps<Theme>;
}

const FormFeedback: React.FC<FormFeedbackProps> = ({
  message,
  severity = 'info',
  onDismiss,
  sx = {},
}) => {
  if (!message) return null;

  // Set colors and icons based on severity
  const getConfig = () => {
    switch (severity) {
      case 'error':
        return {
          color: 'error.main',
          bgColor: 'rgba(244, 67, 54, 0.04)',
          icon: <ErrorOutlineIcon />,
          title: 'Error',
        };
      case 'warning':
        return {
          color: 'warning.main',
          bgColor: 'rgba(255, 152, 0, 0.04)',
          icon: <WarningAmberIcon />,
          title: 'Warning',
        };
      case 'success':
        return {
          color: 'success.main',
          bgColor: 'rgba(76, 175, 80, 0.04)',
          icon: <CheckCircleOutlineIcon />,
          title: 'Success',
        };
      case 'info':
      default:
        return {
          color: 'info.main',
          bgColor: 'rgba(2, 136, 209, 0.04)',
          icon: <InfoOutlinedIcon />,
          title: 'Information',
        };
    }
  };

  const config = getConfig();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        borderLeft: `4px solid ${config.color}`,
        backgroundColor: config.bgColor,
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            color: config.color,
            display: 'flex',
            alignItems: 'center',
            mt: 0.25,
          }}
        >
          {config.icon}
        </Box>

        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Box>

        {onDismiss && (
          <IconButton
            size="small"
            onClick={onDismiss}
            sx={{ mt: -0.5, mr: -0.5, color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Paper>
  );
};

export default FormFeedback;
