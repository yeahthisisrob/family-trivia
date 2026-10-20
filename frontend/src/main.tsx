import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import AppProvider from './AppProvider';
import { AppearanceProvider } from './shared/design-system';
import { ToastProvider } from './shared/toast';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Theme and light/dark: the person's choice, then the family's default (AppearanceProvider). */}
      <AppearanceProvider>
        <ToastProvider>
          <AppProvider />
        </ToastProvider>
      </AppearanceProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
