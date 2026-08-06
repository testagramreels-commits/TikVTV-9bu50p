/**
 * Push-notification hook using browser Notification API + Supabase polling.
 * Polls every 60s for new reactions/comments on favorited channels.
 * Stores notification history in localStorage.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { AppNotification } from '@/types';

// Re-export for convenience
export type { AppNotification };

const STORAGE_KEY = 'tikvtv-notifications';
const POLL_MS     = 60_000;

function loadNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveNotifications(notifs: AppNotification[]) {
  try {
    // Keep only last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)));
  } catch {}
}

export function usePushNotifications() {
  const { user }        = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);
  const [permission,    setPermission]    = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const pollRef      = useRef<ReturnType<typeof setInterval>>();
  const lastPollRef  = useRef<string>(new Date(Date.now() - POLL_MS).toISOString());

  const unreadCount = notifications.filter(n => !n.read).length;

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    const full: AppNotification = {
      ...notif,
      id:        `${Date.now()}-${Math.random()}`,
      read:      false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => {
      const updated = [full, ...prev].slice(0, 50);
      saveNotifications(updated);
      return updated;
    });

    // Fire browser notification if permitted
    if (permission === 'granted') {
      try {
        new Notification(notif.title, { body: notif.body, icon: '/manifest.json' });
      } catch {}
    }

    return full;
  }, [permission]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  // Poll for new reactions/comments on favorited channels
  const poll = useCallback(async () => {
    if (!user) return;

    const since = lastPollRef.current;
    lastPollRef.current = new Date().toISOString();

    // Get user's favorited channel IDs
    const { data: favs } = await supabase
      .from('favorites')
      .select('channel_id, channel_data')
      .eq('user_id', user.id);

    if (!favs || favs.length === 0) return;

    const channelIds = favs.map((f: { channel_id: string }) => f.channel_id);

    // Check new reactions
    const { data: reactions } = await supabase
      .from('reactions')
      .select('channel_id, type, created_at')
      .in('channel_id', channelIds)
      .neq('user_id', user.id)
      .gt('created_at', since)
      .limit(5);

    if (reactions && reactions.length > 0) {
      const grouped = (reactions as { channel_id: string; type: string }[])
        .reduce<Record<string, { count: number; type: string }>>((acc, r) => {
          if (!acc[r.channel_id]) acc[r.channel_id] = { count: 0, type: r.type };
          acc[r.channel_id].count++;
          return acc;
        }, {});

      Object.entries(grouped).forEach(([chId, { count, type }]) => {
        const fav = favs.find((f: { channel_id: string; channel_data: { name?: string } }) => f.channel_id === chId);
        const chName = fav?.channel_data?.name || 'a channel';
        addNotification({
          type:        'reaction',
          title:       `${count} new ${type}${count > 1 ? 's' : ''}`,
          body:        `On ${chName} you follow`,
          channelId:   chId,
          channelName: chName,
        });
      });
    }

    // Check new comments
    const { data: comments } = await supabase
      .from('comments')
      .select('channel_id, content, created_at')
      .in('channel_id', channelIds)
      .neq('user_id', user.id)
      .gt('created_at', since)
      .limit(5);

    if (comments && comments.length > 0) {
      const grouped = (comments as { channel_id: string }[])
        .reduce<Record<string, number>>((acc, c) => {
          acc[c.channel_id] = (acc[c.channel_id] || 0) + 1;
          return acc;
        }, {});

      Object.entries(grouped).forEach(([chId, count]) => {
        const fav = favs.find((f: { channel_id: string; channel_data: { name?: string } }) => f.channel_id === chId);
        const chName = fav?.channel_data?.name || 'a channel';
        addNotification({
          type:        'comment',
          title:       `${count} new comment${count > 1 ? 's' : ''}`,
          body:        `On ${chName} you follow`,
          channelId:   chId,
          channelName: chName,
        });
      });
    }
  }, [user, addNotification]);

  // Start polling when user is logged in
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!user) return;

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, POLL_MS);

    return () => clearInterval(pollRef.current);
  }, [user, poll]);

  return {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    addNotification,
    markRead,
    markAllRead,
    clearAll,
  };
}
