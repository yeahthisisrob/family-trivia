import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useState } from 'react';
import { onSignedOut } from '../../session/session';
import { createQueryClient } from './client';

/**
 * Server data for the app (docs/decisions/0035). Signing out drops all of it,
 * so the next person on this device starts with nothing loaded. Stories and
 * tests pass a fresh `client` each.
 */
export const ServerDataProvider: React.FC<{ client?: QueryClient; children: React.ReactNode }> = ({
  client,
  children,
}) => {
  const [own] = useState(() => client ?? createQueryClient());
  const active = client ?? own;
  useEffect(() => onSignedOut(() => active.clear()), [active]);
  return <QueryClientProvider client={active}>{children}</QueryClientProvider>;
};
