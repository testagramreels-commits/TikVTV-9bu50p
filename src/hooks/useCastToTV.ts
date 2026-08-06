import { useState, useEffect, useCallback } from 'react';

// Google Cast SDK types
declare global {
  interface Window {
    chrome?: {
      cast?: {
        initialize: (apiConfig: unknown, onInitSuccess: () => void, onError: (err: unknown) => void) => void;
        SessionRequest: new (appId: string) => unknown;
        ApiConfig: new (sessionRequest: unknown, onSessionStarted: (session: unknown) => void, onSessionListener: (session: unknown) => void) => unknown;
        requestSession: (onSuccess: (session: unknown) => void, onError: (err: unknown) => void) => void;
      };
    };
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework?: {
        CastContext: {
          getInstance: () => {
            requestSession: () => Promise<void>;
            endCurrentSession: (stopCasting: boolean) => void;
            getCurrentSession: () => {
              loadMedia: (req: unknown) => Promise<void>;
            } | null;
          };
        };
        CastSession: unknown;
        RemotePlayer: new () => unknown;
        RemotePlayerController: new (player: unknown) => { addEventListener: (event: string, cb: () => void) => void };
      };
    };
  }
}

const CAST_APP_ID = 'CC1AD845'; // Default Media Receiver

export function useCastToTV() {
  const [available, setAvailable] = useState(false);
  const [casting,   setCasting]   = useState(false);
  const [loaded,    setLoaded]    = useState(false);

  useEffect(() => {
    // Inject Cast SDK once
    if (loaded || document.getElementById('google-cast-sdk')) { setLoaded(true); return; }

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        try {
          const cast = window.cast?.framework;
          if (!cast) return;
          const ctx = cast.CastContext.getInstance();
          setAvailable(true);
          // Listen for session changes
          console.log('[Cast] SDK ready, context:', ctx);
        } catch (e) {
          console.warn('[Cast] Init error:', e);
        }
      }
    };

    const script = document.createElement('script');
    script.id = 'google-cast-sdk';
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [loaded]);

  const castStream = useCallback(async (streamUrl: string, channelName: string, logoUrl?: string) => {
    if (!window.cast?.framework) {
      // Fallback: try to open in a new tab for smart TV browsers
      window.open(streamUrl, '_blank');
      return;
    }

    try {
      const ctx = window.cast.framework.CastContext.getInstance();
      const session = ctx.getCurrentSession();

      const loadRequest = {
        media: {
          contentId: streamUrl,
          contentType: streamUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
          streamType: 'LIVE',
          metadata: {
            metadataType: 0,
            title: channelName,
            images: logoUrl ? [{ url: logoUrl }] : [],
          },
        },
      };

      if (session) {
        await session.loadMedia(loadRequest);
        setCasting(true);
      } else {
        await ctx.requestSession();
        const newSession = ctx.getCurrentSession();
        if (newSession) {
          await newSession.loadMedia(loadRequest);
          setCasting(true);
        }
      }
    } catch (e) {
      console.error('[Cast] Error:', e);
      // Graceful fallback
      if (navigator.share) {
        await navigator.share({ title: channelName, url: streamUrl });
      }
    }
  }, []);

  const stopCasting = useCallback(() => {
    window.cast?.framework?.CastContext.getInstance().endCurrentSession(true);
    setCasting(false);
  }, []);

  return { available, casting, castStream, stopCasting };
}
