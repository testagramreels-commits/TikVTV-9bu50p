/**
 * Social notifications hook — polls for likes, reposts, comments, follows.
 * Integrates with the social_notifications DB table.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { AppNotification } from '@/types';

const STORAGE_KEY = 'tikvtv-notifications-v2';
const POLL_MS     = 30_000; // 30s polling

function loadStored(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}
function saveStored(n: AppNotification[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n.slice(0, 100))); } catch {}
}

export function usePushNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>(loadStored);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('social_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) return;

    const mapped: AppNotification[] = data.map((n: {
      id: string; type: string; message: string; read: boolean; created_at: string; post_id?: string;
    }) => ({
      id:         n.id,
      type:       (n.type === 'like' || n.type === 'comment' || n.type === 'system' ? n.type : 'reaction') as AppNotification['type'],
      title:      n.type === 'like' ? 'New Like' : n.type === 'repost' ? 'Repost' : n.type === 'comment' ? 'New Comment' : n.type === 'follow' ? 'New Follower' : 'Notification',
      body:       n.message,
      channelId:  n.post_id,
      read:       n.read,
      createdAt:  n.created_at,
    }));

    setNotifications(mapped);
    saveStored(mapped);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    clearInterval(pollRef.current);
    if (user) {
      pollRef.current = setInterval(fetchNotifications, POLL_MS);
    }
    return () => clearInterval(pollRef.current);
  }, [user, fetchNotifications]);

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    const full: AppNotification = {
      ...notif,
      id:        crypto.randomUUID(),
      read:      false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => {
      const next = [full, ...prev].slice(0, 100);
      saveStored(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      saveStored(next);
      return next;
    });
    if (user) {
      await supabase
        .from('social_notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    }
  }, [user]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveStored(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveStored([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAllRead,
    markRead,
    clearAll,
    refresh: fetchNotifications,
  };
}
