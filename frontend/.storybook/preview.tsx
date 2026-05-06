import React from 'react';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { Preview } from '@storybook/react-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { MemoryRouter } from 'react-router-dom';

import { allHandlers } from './mocks/handlers';
import { MockAppProviders } from './mocks/providers';
import { apiService } from '../src/services/ApiService';
import { theme } from '../src/shared/design-system';

// Start MSW once via the addon. The addon installs a loader that swaps in
// per-story `parameters.msw.handlers` on top of these defaults — without
// `mswLoader` below, those per-story handlers are silently ignored.
initialize({ onUnhandledRequest: 'bypass' }, allHandlers);

const preview: Preview = {
  loaders: [mswLoader],
  // Reset ephemeral state before every story so one story can't bleed
  // into the next:
  //   - apiService cache (cached `daily_fact_alice_today` etc.)
  //   - sessionStorage (dismissed tips like the dictation hint)
  beforeEach: async () => {
    apiService.clearCache();
    try { window.sessionStorage.clear(); } catch { /* ok */ }
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter>
          <MockAppProviders>
            <Story />
          </MockAppProviders>
        </MemoryRouter>
      </ThemeProvider>
    ),
  ],
};

export default preview;
