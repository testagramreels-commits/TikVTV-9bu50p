/**
 * Channel lock system — after watching a channel for LOCK_THRESHOLD_MINS minutes
 * (cumulative, across sessions), the channel is locked behind a paywall.
 * State is persisted in localStorage so it survives page refreshes.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const LOCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'channel-watch-time';

function getWatchMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveWatchMap(map: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/** Returns whether a channel is currently locked */
export function isChannelLocked(channelId: string): boolean {
  const map = getWatchMap();
  return (map[channelId] || 0) >= LOCK_THRESHOLD_MS;
}

/** Hook for tracking watch time on the active channel */
export function useChannelLock(channelId: string, isActive: boolean, isReady: boolean) {
  const [locked, setLocked] = useState(() => isChannelLocked(channelId));
  const [watchedMs, setWatchedMs] = useState(() => {
    const map = getWatchMap();
    return map[channelId] || 0;
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const localMs     = useRef(watchedMs);

  // Sync local ref with state
  useEffect(() => { localMs.current = watchedMs; }, [watchedMs]);

  // Tick every second when actively watching
  useEffect(() => {
    clearInterval(intervalRef.current);

    if (!isActive || !isReady || locked) return;

    intervalRef.current = setInterval(() => {
      const map = getWatchMap();
      const prev = map[channelId] || 0;
      const next = prev + 1000;
      map[channelId] = next;
      saveWatchMap(map);
      localMs.current = next;
      setWatchedMs(next);

      if (next >= LOCK_THRESHOLD_MS) {
        setLocked(true);
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [channelId, isActive, isReady, locked]);

  // Re-check lock status when channel changes
  useEffect(() => {
    const already = isChannelLocked(channelId);
    setLocked(already);
    const map = getWatchMap();
    setWatchedMs(map[channelId] || 0);
  }, [channelId]);

  const remainingMs = Math.max(0, LOCK_THRESHOLD_MS - watchedMs);
  const remainingSecs = Math.ceil(remainingMs / 1000);
  const watchedPercent = Math.min(100, (watchedMs / LOCK_THRESHOLD_MS) * 100);

  return { locked, watchedMs, remainingSecs, watchedPercent };
}
