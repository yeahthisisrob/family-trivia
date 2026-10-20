import type { Preview } from '@storybook/react-vite';
import { setupWorker } from 'msw/browser';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { MemoryRouter } from 'react-router-dom';
import { apiService } from '../src/services/ApiService';
import { forgetTab } from '../src/session';
import { AppearanceProvider, THEMES } from '../src/shared/design-system';
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
  initialGlobals: { scheme: 'light', theme: 'classic' },
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
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: THEMES.map((t) => ({ value: t.id, title: t.name })),
        dynamicTitle: true,
      },
    },
  },
  loaders: [mswLoader(startWorker)],
  // Reset ephemeral state before every story so one story can't bleed
  // into the next:
  //   - apiService cache (cached `daily_fact_alice_today` etc.)
  //   - sessionStorage (dismissed tips like the dictation hint)
  //   - the tab's pinned circle and person (session.ts)
  beforeEach: async () => {
    apiService.clearCache();
    forgetTab();
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
      <AppearanceProvider
        key={`${context.globals.theme}-${context.globals.scheme}`}
        initial={{
          themeId: context.globals.theme,
          mode: context.globals.scheme === 'dark' ? 'dark' : 'light',
        }}
      >
        {/* A story can start on a URL with parameters.route, e.g. '/admin/settings?section=ai'. */}
        <MemoryRouter initialEntries={[context.parameters.route ?? '/']}>
          <MockAppProviders>
            <Story />
          </MockAppProviders>
        </MemoryRouter>
      </AppearanceProvider>
    ),
  ],
};

export default preview;
