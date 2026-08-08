/**
 * AdBanner — sponsored content card shown between channels.
 * Uses MagSrv ad network. Rendered as a scroll-snap card in the feed.
 */
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    AdProvider?: { push: (cfg: object) => void }[];
  }
}

interface Props {
  index: number;
}

export default function AdBanner({ index }: Props) {
  const adRef       = useRef<HTMLDivElement>(null);
  const loadedRef   = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !adRef.current) return;
    loadedRef.current = true;

    // Inject ad provider script once
    if (!document.getElementById('magsrv-ad-script')) {
      const script = document.createElement('script');
      script.id    = 'magsrv-ad-script';
      script.async = true;
      script.type  = 'application/javascript';
      script.src   = 'https://a.magsrv.com/ad-provider.js';
      document.head.appendChild(script);
    }

    // Inject the ins tag
    const ins = document.createElement('ins');
    ins.className           = 'eas6a97888e37';
    ins.dataset['zoneid']   = '5207058';
    ins.style.display       = 'block';
    ins.style.width         = '100%';
    ins.style.height        = '100%';
    adRef.current.appendChild(ins);

    // Trigger ad serving
    const trigger = () => {
      (window.AdProvider = window.AdProvider || []).push({ serve: {} });
    };

    if (document.getElementById('magsrv-ad-script')?.getAttribute('data-loaded')) {
      trigger();
    } else {
      document.getElementById('magsrv-ad-script')?.addEventListener('load', () => {
        document.getElementById('magsrv-ad-script')?.setAttribute('data-loaded', '1');
        trigger();
      });
    }
  }, []);

  return (
    <div
      data-index={index}
      className="relative w-full bg-black flex flex-col items-center justify-center"
      style={{ height: '100dvh', scrollSnapAlign: 'start' }}
    >
      {/* Sponsor label */}
      <div className="absolute top-14 left-4 z-10">
        <span className="text-white/30 text-[9px] font-semibold uppercase tracking-widest bg-black/50 backdrop-blur px-2 py-0.5 rounded-sm border border-white/10">
          Sponsored
        </span>
      </div>

      {/* Ad container */}
      <div
        ref={adRef}
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ maxWidth: 480 }}
      />

      {/* Fallback label */}
      <div className="absolute bottom-28 left-0 right-0 text-center pointer-events-none">
        <p className="text-white/10 text-[10px]">Advertisement · Swipe to continue</p>
      </div>
    </div>
  );
}
