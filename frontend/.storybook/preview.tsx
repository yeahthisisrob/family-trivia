import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { Preview } from '@storybook/react-vite';
import { setupWorker } from 'msw/browser';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { MemoryRouter } from 'react-router-dom';
import { apiService } from '../src/services/ApiService';
import { theme } from '../src/shared/design-system';
import { allHandlers } from './mocks/handlers';
import { MockAppProviders } from './mocks/providers';

// MSW starts once with the shared handlers as its baseline. The loader puts a
// story's `parameters.msw.handlers` on top and resets to the baseline after
// each story, so overrides never leak into the next one.
async function startWorker() {
  const worker = setupWorker(...allHandlers);
  await worker.start({ quiet: true, onUnhandledRequest: 'bypass' });
  return worker;
}

const preview: Preview = {
  loaders: [mswLoader(startWorker)],
  // Reset ephemeral state before every story so one story can't bleed
  // into the next:
  //   - apiService cache (cached `daily_fact_alice_today` etc.)
  //   - sessionStorage (dismissed tips like the dictation hint)
  beforeEach: async () => {
    apiService.clearCache();
    try {
      window.sessionStorage.clear();
    } catch {
      /* ok */
    }
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
