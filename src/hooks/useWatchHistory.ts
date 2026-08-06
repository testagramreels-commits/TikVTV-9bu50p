/**
 * Watch history hook — tracks channels user has watched.
 * Stores up to 100 items in localStorage.
 */
import { useState, useCallback } from 'react';
import type { WatchHistoryItem, IPTVChannel } from '@/types';

const STORAGE_KEY = 'tikvtv_watch_history';

function loadHistory(): WatchHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history: WatchHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
  } catch {}
}

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryItem[]>(loadHistory);

  const addToHistory = useCallback((channel: IPTVChannel) => {
    setHistory(prev => {
      // Deduplicate — remove old entry for same channel
      const filtered = prev.filter(item => item.channelId !== channel.id);
      const item: WatchHistoryItem = {
        channelId:   channel.id,
        name:        channel.name,
        logo:        channel.logo,
        country:     channel.country,
        countryCode: channel.countryCode,
        categories:  channel.categories,
        watchedAt:   new Date().toISOString(),
      };
      const updated = [item, ...filtered].slice(0, 100);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addToHistory, clearHistory };
}
