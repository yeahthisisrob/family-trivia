import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

import {
  getNotifications,
  markThreadRead as apiMarkThreadRead,
  markAllRead as apiMarkAllRead,
} from '../api/modules/notifications';
import { createLogger } from '../utils/logger';

import type { CommentContentType, NotificationItem, NotificationSummary } from '@family-trivia/shared';

const logger = createLogger('NotificationContext');

const POLL_INTERVAL = 60_000; // 60 seconds

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
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await getNotifications(userId);
      // Guard against malformed/empty response
      setSummary({
        unreadCount: data?.unreadCount ?? 0,
        items: Array.isArray(data?.items) ? data.items : [],
      });
    } catch (err) {
      logger.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Delayed initial fetch — don't compete with app-init for bandwidth.
  // First fetch after 3s, then poll every 60s.
  useEffect(() => {
    if (!userId) return;
    const initialDelay = setTimeout(() => {
      fetchNotifications();
      pollRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    }, 3000);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(pollRef.current);
    };
  }, [userId, fetchNotifications]);

  const markRead = useCallback(async (contentType: CommentContentType, contentId: string) => {
    if (!userId) return;
    // Optimistic update
    setSummary(prev => {
      const targetId = `comment-${contentType}-${contentId}`;
      const updated = prev.items.map(item =>
        item.id === targetId ? { ...item, read: true } : item,
      );
      return {
        items: updated,
        unreadCount: updated.filter(i => !i.read).length,
      };
    });
    await apiMarkThreadRead(userId, contentType, contentId);
  }, [userId]);

  const markAllReadFn = useCallback(async () => {
    if (!userId) return;
    // Optimistic update
    setSummary(prev => ({
      items: prev.items.map(i => ({ ...i, read: true })),
      unreadCount: 0,
    }));
    await apiMarkAllRead(userId);
  }, [userId]);

  return (
    <NotificationContext.Provider value={{
      unreadCount: summary.unreadCount,
      notifications: summary.items,
      loading,
      refresh: fetchNotifications,
      markRead,
      markAllRead: markAllReadFn,
    }}>
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
