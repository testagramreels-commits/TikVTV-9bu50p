/**
 * Double-back-press to exit (Android PWA / browser).
 * On first back press, shows a toast and re-pushes state.
 * On second press within 2 seconds, closes the app / goes back.
 */
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

export function useBackButtonExit() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const lastPress = useRef<number>(0);
  const toastId   = useRef<string | number | null>(null);

  useEffect(() => {
    // Only activate on root path (the main feed page)
    if (location.pathname !== '/') return;

    // Push a dummy state so back button triggers popstate instead of navigating away
    window.history.pushState({ backGuard: true }, '');

    const handler = (e: PopStateEvent) => {
      // If we're on root path and the popped state had backGuard
      if (location.pathname !== '/') return;

      const now = Date.now();
      if (now - lastPress.current < 2000) {
        // Second press — dismiss toast and exit
        if (toastId.current !== null) toast.dismiss(toastId.current);
        // Try to close the window (works in standalone PWA mode)
        if ((window.navigator as { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches) {
          window.close();
        } else {
          // Fallback: navigate back twice
          window.history.go(-2);
        }
        return;
      }

      // First press — show toast and re-push guard state
      lastPress.current = now;
      toastId.current = toast('Press back again to exit', {
        duration: 2000,
        position: 'bottom-center',
        style: {
          background: 'rgba(30,30,30,0.95)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          fontSize: '14px',
          textAlign: 'center',
        },
      });

      // Re-push the guard state so back works again
      window.history.pushState({ backGuard: true }, '');
    };

    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [location.pathname, navigate]);
}
