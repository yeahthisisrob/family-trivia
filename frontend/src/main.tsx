import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import AppProvider from './AppProvider';
import { ColorModeProvider } from './shared/design-system';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Light or dark: follows the device until someone picks one (ColorModeToggle). */}
      <ColorModeProvider>
        <AppProvider />
      </ColorModeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
