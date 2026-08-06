/**
 * Android TV / Leanback detection and D-pad keyboard navigation.
 * 
 * On Android TV:
 *  - D-pad UP/DOWN scrolls the feed
 *  - D-pad CENTER (OK) toggles mute
 *  - BACK button triggers double-back exit
 *  - LEFT/RIGHT changes category tab
 *  - MEDIA_PLAY_PAUSE toggles play
 */
import { useEffect, useState } from 'react';

export function useIsAndroidTV(): boolean {
  const [isTV, setIsTV] = useState(false);

  useEffect(() => {
    // Detect Android TV / large-screen leanback mode
    const ua = navigator.userAgent.toLowerCase();
    const isAndroidTV =
      ua.includes('googletv') ||
      ua.includes('crkey') ||
      ua.includes('aftt') ||          // FireTV
      ua.includes('aftm') ||
      ua.includes('afte') ||
      ua.includes('afts') ||
      ua.includes('aftb') ||
      ua.includes('smart-tv') ||
      ua.includes('smarttv') ||
      ua.includes('hbbtv') ||
      ua.includes('netcast') ||
      ua.includes('philipstv') ||
      // Large screen with no touch
      (window.innerWidth >= 1280 && !('ontouchstart' in window) && ua.includes('android'));

    setIsTV(isAndroidTV);
    if (isAndroidTV) {
      document.documentElement.classList.add('tv-mode');
      console.log('[TV] Android TV mode detected');
    }
  }, []);

  return isTV;
}

export function useTVKeyboardNav({
  onUp,
  onDown,
  onLeft,
  onRight,
  onSelect,
  onBack,
  onPlayPause,
  enabled = true,
}: {
  onUp?:       () => void;
  onDown?:     () => void;
  onLeft?:     () => void;
  onRight?:    () => void;
  onSelect?:   () => void;
  onBack?:     () => void;
  onPlayPause?: () => void;
  enabled?:    boolean;
}) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onDown?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onRight?.();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect?.();
          break;
        case 'Escape':
        case 'GoBack':
        case 'BrowserBack':
          e.preventDefault();
          onBack?.();
          break;
        case 'MediaPlayPause':
        case 'MediaPlay':
        case 'MediaPause':
          e.preventDefault();
          onPlayPause?.();
          break;
        case 'k': // YouTube-style keyboard shortcut
          onPlayPause?.();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onUp, onDown, onLeft, onRight, onSelect, onBack, onPlayPause]);
}
