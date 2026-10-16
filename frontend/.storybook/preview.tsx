import type { Preview } from '@storybook/react-vite';
import { setupWorker } from 'msw/browser';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { MemoryRouter } from 'react-router-dom';
import { apiService } from '../src/services/ApiService';
import { ColorModeProvider } from '../src/shared/design-system';
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
  initialGlobals: { scheme: 'light' },
  globalTypes: {
    scheme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Scheme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
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
    (Story, context) => (
      <ColorModeProvider
        key={context.globals.scheme}
        initialMode={context.globals.scheme === 'dark' ? 'dark' : 'light'}
      >
        <MemoryRouter>
          <MockAppProviders>
            <Story />
          </MockAppProviders>
        </MemoryRouter>
      </ColorModeProvider>
    ),
  ],
};

export default preview;
