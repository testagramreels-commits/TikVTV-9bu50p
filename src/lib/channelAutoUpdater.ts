/**
 * Auto-sync channels worldwide.
 * - Checks iptv-org API version via HEAD every 4 hours
 * - Also syncs on visibility change (tab comes back into focus)
 * - Force-refreshes cache when new version detected
 * - Emits 'tikvtv:channels-updated' event so Feed.tsx can reload
 */

const CHANNELS_API   = 'https://iptv-org.github.io/api/channels.json';
const CACHE_KEY      = 'tikvtv_iptv_v12';   // must match iptvApi.ts
const VERSION_KEY    = 'tikvtv_channel_version';
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;  // 4 hours (down from 6)
const UPDATE_EVENT   = 'tikvtv:channels-updated';

let updateTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastCheck = 0;
const MIN_CHECK_GAP = 15 * 60 * 1000; // don't check more than once per 15 min

async function getRemoteVersion(): Promise<string> {
  try {
    const res = await fetch(CHANNELS_API, {
      method: 'HEAD',
      cache:  'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    return res.headers.get('etag') || res.headers.get('last-modified') || String(Date.now());
  } catch {
    return '';
  }
}

async function checkForUpdates(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheck < MIN_CHECK_GAP) return false;
  lastCheck = now;

  const remoteVersion = await getRemoteVersion();
  if (!remoteVersion) return false;

  const cached = localStorage.getItem(VERSION_KEY) || '';
  if (remoteVersion !== cached) {
    console.log('[AutoSync] New worldwide channel data detected:', remoteVersion);
    localStorage.removeItem(CACHE_KEY);
    localStorage.setItem(VERSION_KEY, remoteVersion);
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { version: remoteVersion } }));
    return true;
  }

  console.log('[AutoSync] Channels worldwide are up to date');
  return false;
}

// Sync on tab visibility (when user returns to app after a while)
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    const lastSync = parseInt(localStorage.getItem('tikvtv_last_sync') || '0');
    if (Date.now() - lastSync > 2 * 60 * 60 * 1000) { // 2h gap
      checkForUpdates();
    }
  }
}

export function startChannelAutoUpdater() {
  if (isRunning) return;
  isRunning = true;

  // First check after 8s (don't block initial load)
  setTimeout(() => {
    checkForUpdates();
    localStorage.setItem('tikvtv_last_sync', String(Date.now()));
  }, 8_000);

  // Periodic sync every 4 hours
  updateTimer = setInterval(() => {
    checkForUpdates();
    localStorage.setItem('tikvtv_last_sync', String(Date.now()));
  }, CHECK_INTERVAL);

  // Sync when tab becomes visible again
  document.addEventListener('visibilitychange', handleVisibilityChange);

  console.log('[AutoSync] Worldwide channel auto-sync started (every 4h)');
}

export function stopChannelAutoUpdater() {
  if (updateTimer) { clearInterval(updateTimer); updateTimer = null; }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  isRunning = false;
}

export function onChannelsUpdated(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(UPDATE_EVENT, handler);
  return () => window.removeEventListener(UPDATE_EVENT, handler);
}

export function forceChannelRefresh() {
  localStorage.removeItem(CACHE_KEY);
  lastCheck = 0;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}
