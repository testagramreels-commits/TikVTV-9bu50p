/**
 * React hook that listens for channel auto-update events
 * and triggers a feed reload when new channels are available.
 */
import { useEffect, useState } from 'react';
import { onChannelsUpdated, startChannelAutoUpdater } from '@/lib/channelAutoUpdater';

export function useChannelAutoUpdate(onUpdate?: () => void) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Start the background updater
    startChannelAutoUpdater();

    // Listen for update events
    const stop = onChannelsUpdated(() => {
      console.log('[Hook] Channel update detected');
      setUpdateAvailable(true);
      onUpdate?.();
    });

    return stop;
  }, [onUpdate]);

  return { updateAvailable, setUpdateAvailable };
}
