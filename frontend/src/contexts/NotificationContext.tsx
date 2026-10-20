import type {
  CommentContentType,
  NotificationItem,
  NotificationSummary,
} from '@family-trivia/shared';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  markAllRead as apiMarkAllRead,
  markThreadRead as apiMarkThreadRead,
  getNotifications,
} from '../api/modules/notifications';
import { notificationMessage } from '../components/Notifications/notificationText';
import { useToast } from '../shared/toast';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotificationContext');

const POLL_INTERVAL = 60_000; // 60 seconds

/** Opens the bell's panel from anywhere (a toast's View, for one). */
const OPEN_EVENT = 'ft:open-notifications';
const openNotifications = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const onOpenNotifications = (f: () => void) => {
  window.addEventListener(OPEN_EVENT, f);
  return () => window.removeEventListener(OPEN_EVENT, f);
};

/** The unread count on the home-screen icon, where the phone supports it. */
function setAppBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  const done = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
  done?.catch(() => undefined);
}

// ── Context Type ──────────────────────────────────────────────────

interface NotificationContextType {
  unreadCount: number;
  notifications: NotificationItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (contentType: CommentContentType, contentId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────

interface NotificationProviderProps {
  userId: string | null;
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ userId, children }) => {
  const [summary, setSummary] = useState<NotificationSummary>({ unreadCount: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const toast = useToast();
  // Ids already seen while the app is open: only what arrives after shows a toast.
  const seen = useRef<Set<string> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await getNotifications(userId);
      // Guard against malformed/empty response
      const items = Array.isArray(data?.items) ? data.items : [];
      const fresh = seen.current ? items.filter((i) => !i.read && !seen.current?.has(i.id)) : [];
      seen.current = new Set(items.map((i) => i.id));
      if (fresh.length)
        toast({
          message:
            fresh.length === 1 ? notificationMessage(fresh[0]) : `${fresh.length} new for you`,
          action: { label: 'View', onClick: openNotifications },
        });
      setSummary({ unreadCount: data?.unreadCount ?? 0, items });
    } catch (err) {
      logger.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  // Delayed initial fetch — don't compete with app-init for bandwidth.
  // First fetch after 3s, then poll every 60s while the app is on screen. Coming
  // back to it (the home-screen app, a tab) checks at once (0031).
  useEffect(() => {
    if (!userId) return;
    const start = () => {
      clearInterval(pollRef.current);
      if (document.hidden) return;
      pollRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    };
    const initialDelay = setTimeout(() => {
      fetchNotifications();
      start();
    }, 3000);
    const onVisible = () => {
      if (document.hidden) return clearInterval(pollRef.current);
      fetchNotifications();
      start();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, fetchNotifications]);

  useEffect(() => setAppBadge(summary.unreadCount), [summary.unreadCount]);

  const markRead = useCallback(
    async (contentType: CommentContentType, contentId: string) => {
      if (!userId) return;
      // Optimistic update
      setSummary((prev) => {
        const targetId = `comment-${contentType}-${contentId}`;
        const updated = prev.items.map((item) =>
          item.id === targetId ? { ...item, read: true } : item,
        );
        return {
          items: updated,
          unreadCount: updated.filter((i) => !i.read).length,
        };
      });
      await apiMarkThreadRead(userId, contentType, contentId);
    },
    [userId],
  );

  const markAllReadFn = useCallback(async () => {
    if (!userId) return;
    // Optimistic update
    setSummary((prev) => ({
      items: prev.items.map((i) => ({ ...i, read: true })),
      unreadCount: 0,
    }));
    await apiMarkAllRead(userId);
  }, [userId]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount: summary.unreadCount,
        notifications: summary.items,
        loading,
        refresh: fetchNotifications,
        markRead,
        markAllRead: markAllReadFn,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
