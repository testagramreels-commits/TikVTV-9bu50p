/**
 * Chromecast integration using the Cast SDK.
 * Loads the Google Cast SDK and provides helper hooks for casting
 * HLS streams to nearby Chromecast devices.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework: {
        CastContext: {
          getInstance: () => CastContextInstance;
        };
        CastState: {
          NO_DEVICES_AVAILABLE: string;
          NOT_CONNECTED: string;
          CONNECTING: string;
          CONNECTED: string;
        };
        SessionState: {
          SESSION_ENDED: string;
        };
      };
    };
    chrome?: {
      cast: {
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (url: string, mimeType: string) => MediaInfo;
          GenericMediaMetadata: new () => MediaMetadata;
          LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
          MetadataType: { GENERIC: number };
        };
        AutoJoinPolicy: {
          ORIGIN_SCOPED: string;
        };
        initialize: (options: unknown, onSuccess: () => void, onError: () => void) => void;
      };
    };
  }

  interface CastContextInstance {
    setOptions: (options: {
      receiverApplicationId: string;
      autoJoinPolicy: string;
    }) => void;
    requestSession: () => Promise<void>;
    getCurrentSession: () => CastSession | null;
    getCastState: () => string;
    addEventListener: (event: string, handler: () => void) => void;
    removeEventListener: (event: string, handler: () => void) => void;
  }

  interface CastSession {
    loadMedia: (req: LoadRequest) => Promise<void>;
  }

  interface MediaInfo {
    metadata: MediaMetadata;
  }

  interface MediaMetadata {
    metadataType: number;
    title: string;
    subtitle: string;
    images: Array<{ url: string }>;
  }

  interface LoadRequest {}
}

let sdkLoaded = false;
let sdkLoading = false;
const listeners: Array<() => void> = [];

function loadCastSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (sdkLoaded) { resolve(); return; }
    if (sdkLoading) { listeners.push(resolve); return; }
    sdkLoading = true;

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        sdkLoaded = true;
        resolve();
        listeners.forEach(l => l());
        listeners.length = 0;
      }
    };

    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    document.head.appendChild(script);
  });
}

export type CastStatus = 'unavailable' | 'idle' | 'connecting' | 'connected';

export function useChromecast(streamUrl: string, channelName: string, channelLogo?: string) {
  const [status, setStatus] = useState<CastStatus>('unavailable');
  const contextRef = useRef<CastContextInstance | null>(null);

  useEffect(() => {
    let mounted = true;

    loadCastSDK().then(() => {
      if (!mounted || !window.cast) return;

      const ctx = window.cast.framework.CastContext.getInstance();
      contextRef.current = ctx;

      ctx.setOptions({
        receiverApplicationId: window.chrome?.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
        autoJoinPolicy: 'origin_scoped',
      });

      const updateStatus = () => {
        if (!mounted || !window.cast) return;
        const state = ctx.getCastState();
        const CastState = window.cast.framework.CastState;
        if (state === CastState.NO_DEVICES_AVAILABLE) setStatus('unavailable');
        else if (state === CastState.NOT_CONNECTED)    setStatus('idle');
        else if (state === CastState.CONNECTING)       setStatus('connecting');
        else                                           setStatus('connected');
      };

      ctx.addEventListener('caststatechanged', updateStatus);
      updateStatus();

      return () => {
        ctx.removeEventListener('caststatechanged', updateStatus);
      };
    }).catch(() => {
      // Cast SDK not available (not Chrome or blocked)
    });

    return () => { mounted = false; };
  }, []);

  const startCasting = useCallback(async () => {
    if (!window.cast || !window.chrome?.cast) return;

    const ctx = contextRef.current;
    if (!ctx) return;

    try {
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) return;

      const { cast: chromecastApi } = window.chrome;
      const mediaInfo = new chromecastApi.media.MediaInfo(streamUrl, 'application/x-mpegURL');
      const metadata = new chromecastApi.media.GenericMediaMetadata();
      metadata.metadataType = chromecastApi.media.MetadataType.GENERIC;
      metadata.title = channelName;
      metadata.subtitle = 'Live TV · TikVTV';
      if (channelLogo) {
        metadata.images = [{ url: channelLogo }];
      }
      mediaInfo.metadata = metadata;

      const loadRequest = new chromecastApi.media.LoadRequest(mediaInfo);
      await session.loadMedia(loadRequest);
    } catch (e) {
      console.warn('[Cast] Error:', e);
    }
  }, [streamUrl, channelName, channelLogo]);

  const stopCasting = useCallback(async () => {
    // Cast stops when user taps the cast button overlay natively
    // No programmatic stop needed for basic integration
  }, []);

  return { status, startCasting, stopCasting };
}
