// File: .storybook/mocks/browser.ts
// MSW browser worker setup for Storybook.

import { setupWorker } from 'msw/browser';
import { allHandlers } from './handlers';

export const worker = setupWorker(...allHandlers);
