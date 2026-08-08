/**
 * VastPreRoll — plays a VAST pre-roll ad video before the main stream/clip.
 * Fetches the VAST XML, extracts the first MediaFile URL, and plays it with:
 *  - 5s skip countdown
 *  - Click-through tracking
 *  - Impression/tracking URL firing
 *  - Muted by default (un-mutable by user)
 *
 * Usage:
 *  <VastPreRoll vastUrl="https://s.magsrv.com/v1/vast.php?idz=5997704"
 *               onComplete={() => setShowAd(false)} />
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, X, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const VAST_URL = 'https://s.magsrv.com/v1/vast.php?idz=5997704';
const SKIP_AFTER_SECS = 5;

interface Props {
  vastUrl?: string;
  onComplete: () => void;
  /** If true, show "Watch this ad to continue" message */
  showMessage?: boolean;
}

interface VastData {
  mediaUrl:       string;
  clickThrough?:  string;
  impressions:    string[];
  trackingEvents: { event: string; url: string }[];
  duration:       number;
}

async function fetchVast(url: string): Promise<VastData | null> {
  try {
    const res = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const xml  = await res.text();
    const doc  = new DOMParser().parseFromString(xml, 'text/xml');

    // Extract first MediaFile (prefer MP4)
    const mediaFiles = Array.from(doc.querySelectorAll('MediaFile'));
    const mp4 = mediaFiles.find(m => m.getAttribute('type')?.includes('mp4') || m.getAttribute('type')?.includes('video'));
    const mediaUrl = (mp4 || mediaFiles[0])?.textContent?.trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
    if (!mediaUrl) return null;

    // Click-through
    const clickThrough = doc.querySelector('ClickThrough')?.textContent?.trim()
      .replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();

    // Impressions
    const impressions = Array.from(doc.querySelectorAll('Impression'))
      .map(i => i.textContent?.trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() || '')
      .filter(Boolean);

    // Tracking events
    const trackingEvents = Array.from(doc.querySelectorAll('Tracking'))
      .map(t => ({
        event: t.getAttribute('event') || '',
        url:   t.textContent?.trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() || '',
      }))
      .filter(t => t.url);

    // Duration
    const durStr = doc.querySelector('Duration')?.textContent?.trim() || '00:00:30';
    const parts  = durStr.split(':').map(Number);
    const duration = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 30);

    return { mediaUrl, clickThrough, impressions, trackingEvents, duration };
  } catch (e) {
    console.warn('[VAST] fetch error:', e);
    return null;
  }
}

function fireUrl(url: string) {
  try { fetch(url, { mode: 'no-cors' }).catch(() => {}); } catch {}
}

export default function VastPreRoll({ vastUrl = VAST_URL, onComplete, showMessage = true }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [vast,    setVast]    = useState<VastData | null>(null);
  const [failed,  setFailed]  = useState(false);
  const [muted,   setMuted]   = useState(true);
  const [skip,    setSkip]    = useState(SKIP_AFTER_SECS);
  const [canSkip, setCanSkip] = useState(false);
  const [progress, setProgress] = useState(0);
  const impressionFired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchVast(vastUrl).then(data => {
      if (cancelled) return;
      if (!data) { setFailed(true); return; }
      setVast(data);
    });
    return () => { cancelled = true; };
  }, [vastUrl]);

  // If VAST fails, complete immediately
  useEffect(() => {
    if (failed) onComplete();
  }, [failed, onComplete]);

  // Countdown to skip button
  useEffect(() => {
    if (!vast) return;
    const interval = setInterval(() => {
      setSkip(s => {
        if (s <= 1) { setCanSkip(true); clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [vast]);

  // Attach video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !vast) return;

    const onPlay = () => {
      if (!impressionFired.current) {
        impressionFired.current = true;
        vast.impressions.forEach(fireUrl);
        vast.trackingEvents.filter(t => t.event === 'start').forEach(t => fireUrl(t.url));
      }
    };
    const onTime = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
      // Fire quartile events
      const pct = (video.currentTime / video.duration) * 100;
      if (pct >= 25)  vast.trackingEvents.filter(t => t.event === 'firstQuartile').forEach(t => { fireUrl(t.url); });
      if (pct >= 50)  vast.trackingEvents.filter(t => t.event === 'midpoint').forEach(t => { fireUrl(t.url); });
      if (pct >= 75)  vast.trackingEvents.filter(t => t.event === 'thirdQuartile').forEach(t => { fireUrl(t.url); });
    };
    const onEnded = () => {
      vast.trackingEvents.filter(t => t.event === 'complete').forEach(t => fireUrl(t.url));
      onComplete();
    };

    video.addEventListener('play',      onPlay);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended',     onEnded);
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('play',       onPlay);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended',      onEnded);
    };
  }, [vast, onComplete]);

  const handleSkip = useCallback(() => {
    if (!canSkip) return;
    vast?.trackingEvents.filter(t => t.event === 'skip').forEach(t => fireUrl(t.url));
    onComplete();
  }, [canSkip, vast, onComplete]);

  const handleClick = () => {
    if (vast?.clickThrough) {
      vast.trackingEvents.filter(t => t.event === 'clickTracking').forEach(t => fireUrl(t.url));
      window.open(vast.clickThrough, '_blank', 'noopener,noreferrer');
    }
  };

  if (!vast) return (
    <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-white/40 text-xs">Loading ad…</p>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col">
      {/* Ad video */}
      <div className="flex-1 relative cursor-pointer" onClick={handleClick}>
        <video
          ref={videoRef}
          src={vast.mediaUrl}
          className="w-full h-full object-contain"
          muted={muted}
          playsInline
          preload="auto"
        />

        {/* Click CTA overlay */}
        {vast.clickThrough && (
          <div className="absolute bottom-16 left-4 right-4 pointer-events-none">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur border border-white/15 rounded-xl px-3 py-2 w-fit">
              <Play className="w-3.5 h-3.5 text-white/70 fill-white/70" />
              <span className="text-white/70 text-xs font-semibold">Learn More</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
        <div className="h-full bg-white transition-none" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-safe-top pt-3 pb-2 pointer-events-none">
        <div className="bg-black/60 backdrop-blur border border-white/15 text-white/50 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm">
          Ad
        </div>
        {showMessage && (
          <div className="bg-black/60 backdrop-blur text-white/30 text-[9px] px-2 py-1 rounded-sm">
            Watch to continue
          </div>
        )}
      </div>

      {/* Mute toggle */}
      <button
        className="absolute top-12 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/15 flex items-center justify-center pointer-events-auto"
        onClick={e => { e.stopPropagation(); setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }}
      >
        {muted
          ? <VolumeX className="w-4 h-4 text-white/60" />
          : <Volume2 className="w-4 h-4 text-white/80" />}
      </button>

      {/* Skip button */}
      <button
        onClick={e => { e.stopPropagation(); handleSkip(); }}
        className={cn(
          'absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all',
          canSkip
            ? 'bg-white text-black hover:bg-white/90 pointer-events-auto'
            : 'bg-black/60 text-white/40 border border-white/15 pointer-events-none'
        )}
      >
        {canSkip
          ? <><X className="w-3 h-3" /> Skip Ad</>
          : <>Skip in {skip}s</>}
      </button>
    </div>
  );
}
