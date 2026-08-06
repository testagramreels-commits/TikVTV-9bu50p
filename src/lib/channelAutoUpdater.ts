/**
 * Auto-update service for channel sources.
 *
 * Strategy:
 * 1. On startup, check the iptv-org API version endpoint
 * 2. Compare against cached version hash
 * 3. If changed, invalidate localStorage cache so next fetch gets fresh data
 * 4. Re-run every 6 hours in the background
 * 5. Emit a 'channels-updated' custom event so Feed.tsx can reload
 */

const VERSION_URL    = 'https://iptv-org.github.io/api/channels.json';
const CACHE_KEY      = 'tikvtv_iptv_v12'; // must match iptvApi.ts
const VERSION_KEY    = 'tikvtv_channel_version';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const UPDATE_EVENT   = 'tikvtv:channels-updated';

let updateTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function getRemoteVersion(): Promise<string> {
  try {
    const res = await fetch(VERSION_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    return res.headers.get('etag') || res.headers.get('last-modified') || '';
  } catch {
    return '';
  }
}

async function checkForUpdates(): Promise<boolean> {
  const remoteVersion = await getRemoteVersion();
  if (!remoteVersion) return false;

  const cachedVersion = localStorage.getItem(VERSION_KEY) || '';

  if (remoteVersion !== cachedVersion) {
    console.log('[AutoUpdate] New channel version detected:', remoteVersion);
    localStorage.removeItem(CACHE_KEY);
    localStorage.setItem(VERSION_KEY, remoteVersion);
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { version: remoteVersion } }));
    return true;
  }

  console.log('[AutoUpdate] Channels are up to date');
  return false;
}

export function startChannelAutoUpdater() {
  if (isRunning) return;
  isRunning = true;
  // Check after 10s to not block initial load
  setTimeout(() => { checkForUpdates(); }, 10_000);
  // Periodic check every 6 hours
  updateTimer = setInterval(() => { checkForUpdates(); }, CHECK_INTERVAL);
  console.log('[AutoUpdate] Channel auto-updater started');
}

export function stopChannelAutoUpdater() {
  if (updateTimer) { clearInterval(updateTimer); updateTimer = null; }
  isRunning = false;
}

export function onChannelsUpdated(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(UPDATE_EVENT, handler);
  return () => window.removeEventListener(UPDATE_EVENT, handler);
}

export function forceChannelRefresh() {
  localStorage.removeItem(CACHE_KEY);
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}
