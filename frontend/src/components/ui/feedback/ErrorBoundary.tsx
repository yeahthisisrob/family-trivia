// ErrorBoundary — wraps a subtree so one crash doesn't kill the entire tab.
// Logs the error and shows a minimal recovery UI with a Reset button.

import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import React from 'react';

import { createLogger } from '../../../utils/logger';

const logger = createLogger('ErrorBoundary');

interface ErrorBoundaryProps {
  /** Name used in logs and shown in the UI */
  label?: string;
  /** Custom fallback render. If omitted, shows a default reset card. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error('Caught error in boundary', {
      label: this.props.label,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }

    const { label = 'this section' } = this.props;
    return (
      <Box sx={{ p: 1 }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <AlertTitle sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Something broke in {label}
          </AlertTitle>
          <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
            {this.state.error.message}
          </Box>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={this.reset}>
            Try again
          </Button>
        </Alert>
      </Box>
    );
  }
}

export default ErrorBoundary;
