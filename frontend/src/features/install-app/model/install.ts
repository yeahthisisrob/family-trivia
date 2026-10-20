/**
 * The home-screen app (docs/decisions/0031): is it already installed, which
 * phone is this, and the browser's own install prompt where there is one
 * (Android and desktop Chrome). iPhone has no prompt: Safari's Share sheet
 * does it.
 */
import { useEffect, useState } from 'react';

type Platform = 'ios' | 'android' | 'desktop';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The prompt fires once, early, often before React is up: keep it here.
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    for (const f of listeners) f();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    for (const f of listeners) f();
  });
}

function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'ios';
  return /Android/.test(ua) ? 'android' : 'desktop';
}

function standalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Opened inside Gmail, Messages' preview or another app: Safari has to open it first. */
function inAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|GSA\/|Line\/|Snapchat/.test(navigator.userAgent);
}

export interface InstallState {
  platform: Platform;
  installed: boolean;
  inAppBrowser: boolean;
  /** The browser can install it with one tap. */
  canPrompt: boolean;
  prompt: () => Promise<boolean>;
}

export function useInstall(): InstallState {
  const [, rerender] = useState(0);
  useEffect(() => {
    const f = () => rerender((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return {
    platform: platform(),
    installed: standalone(),
    inAppBrowser: inAppBrowser(),
    canPrompt: deferred !== null,
    prompt: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      return outcome === 'accepted';
    },
  };
}

const DISMISSED = 'ft.install-hint.dismissed';

export const hintDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
};

export const dismissHint = (): void => {
  try {
    localStorage.setItem(DISMISSED, '1');
  } catch {
    /* private mode: it asks again next time */
  }
};
