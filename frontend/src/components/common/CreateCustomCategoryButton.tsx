// File: src/components/common/CreateCustomCategoryButton.tsx
import AddIcon from '@mui/icons-material/Add';
import StarsIcon from '@mui/icons-material/Stars';
import { Box, Button } from '@mui/material';
import React from 'react';

import appStrings from '../../constants/strings';
import { createLogger } from '../../utils/logger';

// Initialize logger
const logger = createLogger('CustomCategoryButton');

interface CreateCustomCategoryButtonProps {
  onCreateCustomCategory?: () => void;
  variant?: 'default' | 'contained' | 'outlined';
  icon?: 'stars' | 'add';
  label?: string;
  withContainer?: boolean;
  size?: 'small' | 'medium' | 'large';
  sx?: Record<string, unknown>;
}

/**
 * Common button component for creating custom categories.
 * This component can be used in different contexts with different styles.
 *
 * It handles its own event propagation to prevent bubbling issues.
 */
const CreateCustomCategoryButton: React.FC<CreateCustomCategoryButtonProps> = ({
  onCreateCustomCategory,
  variant = 'default',
  icon = 'stars',
  label = appStrings.createCustomCategory,
  withContainer = true,
  size = 'small',
  sx = {},
}) => {
  // Determine the actual Material-UI variant based on our custom variants
  const muiVariant = variant === 'default' ? 'contained' : variant;

  // Create the button with event handling
  const button = (
    <Button
      variant={muiVariant}
      color="secondary"
      startIcon={icon === 'stars' ? <StarsIcon /> : <AddIcon />}
      size={size}
      onClick={(e) => {
        logger.debug('Custom category button clicked');
        // Prevent all event propagation
        e.stopPropagation();
        e.preventDefault();
        e.nativeEvent?.stopImmediatePropagation?.();
        // Call the callback if provided
        if (onCreateCustomCategory) {
          logger.debug('Calling onCreateCustomCategory handler');
          onCreateCustomCategory();
        }
        // Return false to prevent any additional handling
        return false;
      }}
      sx={{
        fontSize: size === 'small' ? '0.8rem' : undefined,
        mt: 1,
        position: 'relative',
        zIndex: 10,
        ...sx,
      }}
    >
      {label}
    </Button>
  );

  // If withContainer is true, wrap the button in a container that also prevents event bubbling
  if (withContainer) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          marginBottom: 3,
          padding: 1,
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        }}
        onClick={(e) => {
          // Stop propagation to prevent any event bubbling
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {button}
      </Box>
    );
  }

  // Otherwise just return the button
  return button;
};

export default CreateCustomCategoryButton;
