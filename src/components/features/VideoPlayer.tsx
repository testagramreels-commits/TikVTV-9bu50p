/**
 * VideoPlayer — ultra-smooth streaming strategy.
 * Key improvements:
 * - Aggressive pre-buffering: starts loading immediately on shouldLoad
 * - Smart ABR: keeps lowest stable quality instead of hunting up
 * - Stall recovery: automatic nudge + restart
 * - Backoff retry with exponential delay
 * - Network-aware quality selection
 */
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  Volume2, VolumeX, WifiOff, RefreshCw, PictureInPicture2,
  Settings2, Check, Maximize2, Minimize2, Moon, Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSleepTimer } from '@/hooks/useSleepTimer';
import { useNetworkQuality, qualityToInitialBitrate } from '@/hooks/useNetworkQuality';
import SleepTimerOverlay from './SleepTimerOverlay';
import type { QualityLevel } from '@/types';

export interface VideoPlayerHandle {
  play:       () => void;
  pause:      () => void;
  getEl:      () => HTMLVideoElement | null;
  toggleMute: () => void;
}

interface Props {
  src:          string;
  isActive:     boolean;
  shouldLoad:   boolean;
  channelName:  string;
  channelLogo?: string;
  onError?:     () => void;
  onReady?:     () => void;
}

const MAX_HLS_INSTANCES = 5;
const MAX_RETRIES       = 6;
const TIMEOUT_MS        = 35_000;

// Global HLS instance registry
const hlsRegistry = new Set<{ destroy: () => void; src: string }>();
function registerHls(entry: { destroy: () => void; src: string }) {
  hlsRegistry.add(entry);
  if (hlsRegistry.size > MAX_HLS_INSTANCES) {
    const oldest = hlsRegistry.values().next().value;
    if (oldest) { oldest.destroy(); hlsRegistry.delete(oldest); }
  }
}
function unregisterHls(entry: { destroy: () => void; src: string }) {
  hlsRegistry.delete(entry);
}

// Animated waveform buffer indicator
function BufferWave({ progress }: { progress: number }) {
  const bars = 24;
  return (
    <div className="flex items-end gap-[2px] h-9">
      {Array.from({ length: bars }).map((_, i) => {
        const filled = i / bars < progress;
        const baseH  = 4 + Math.abs(Math.sin((i / bars) * Math.PI * 3)) * 14;
        return (
          <div key={i}
            className={cn('w-[3px] rounded-full transition-all duration-200',
              filled ? 'bg-primary' : 'bg-white/10')}
            style={{ height: `${filled ? baseH : 3}px` }}
          />
        );
      })}
    </div>
  );
}

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ src, isActive, shouldLoad, channelName, channelLogo, onError, onReady }, ref) => {
    const videoRef   = useRef<HTMLVideoElement>(null);
    const wrapRef    = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hlsRef     = useRef<any>(null);
    const hlsEntry   = useRef<{ destroy: () => void; src: string } | null>(null);
    const timerRef   = useRef<ReturnType<typeof setTimeout>>();
    const retryRef   = useRef<ReturnType<typeof setTimeout>>();
    const pollRef    = useRef<ReturnType<typeof setInterval>>();
    const stallTimer = useRef<ReturnType<typeof setTimeout>>();
    const readyRef   = useRef(false);
    const retryCount = useRef(0);
    const mountedRef = useRef(true);
    const srcRef     = useRef(src);

    const [muted,          setMuted]          = useState(true);
    const [error,          setError]          = useState(false);
    const [buffering,      setBuffering]       = useState(false);
    const [ready,          setReady]          = useState(false);
    const [bufProgress,    setBufProgress]    = useState(0);
    const [pipActive,      setPipActive]      = useState(false);
    const [fullscreen,     setFullscreen]     = useState(false);
    const [qualities,      setQualities]      = useState<QualityLevel[]>([]);
    const [currentLvl,     setCurrentLvl]     = useState(-1);
    const [showQuality,    setShowQuality]    = useState(false);
    const [showSleep,      setShowSleep]      = useState(false);
    const [stallCount,     setStallCount]     = useState(0);

    const networkQuality = useNetworkQuality();
    const pipSupported   = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;
    const fsSupported    = typeof document !== 'undefined' && 'fullscreenEnabled' in document;

    const sleepTimer = useSleepTimer(() => { videoRef.current?.pause(); });

    useImperativeHandle(ref, () => ({
      play:       () => videoRef.current?.play().catch(() => {}),
      pause:      () => videoRef.current?.pause(),
      getEl:      () => videoRef.current,
      toggleMute: () => setMuted(m => !m),
    }));

    useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
    }, []);

    // Poll buffer ahead for smooth waveform
    const startBufPoll = useCallback(() => {
      clearInterval(pollRef.current);
      const TARGET = 20; // 20s target buffer
      pollRef.current = setInterval(() => {
        const v = videoRef.current;
        if (!v || !mountedRef.current) return;
        let ahead = 0;
        for (let i = 0; i < v.buffered.length; i++) {
          if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) > v.currentTime) {
            ahead = v.buffered.end(i) - v.currentTime;
            break;
          }
        }
        setBufProgress(Math.min(1, ahead / TARGET));
      }, 400);
    }, []);

    // Core init
    useEffect(() => {
      if (!shouldLoad || !src) return;
      const video = videoRef.current;
      if (!video) return;
      srcRef.current = src;

      if (mountedRef.current) {
        setError(false); setReady(false); setBuffering(true);
        setQualities([]); setCurrentLvl(-1);
        setBufProgress(0); setStallCount(0);
      }
      readyRef.current = false;

      const destroyHls = () => {
        clearInterval(pollRef.current);
        clearTimeout(stallTimer.current);
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch {}
          hlsRef.current = null;
        }
        if (hlsEntry.current) {
          unregisterHls(hlsEntry.current);
          hlsEntry.current = null;
        }
      };

      const markReady = () => {
        clearTimeout(timerRef.current);
        if (!mountedRef.current || srcRef.current !== src) return;
        readyRef.current = true;
        setReady(true);
        setBuffering(false);
        retryCount.current = 0;
        onReady?.();
        if (isActive) {
          video.muted = muted;
          video.play().catch(() => {});
        }
      };

      const markError = () => {
        clearTimeout(timerRef.current);
        if (!mountedRef.current) return;
        if (retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          const delay = Math.min(1500 * retryCount.current, 10_000);
          console.log(`[Player] Retry ${retryCount.current}/${MAX_RETRIES} in ${delay}ms`);
          setBuffering(true);
          retryRef.current = setTimeout(() => {
            if (mountedRef.current) reinit();
          }, delay);
        } else {
          setError(true);
          setBuffering(false);
          onError?.();
        }
      };

      timerRef.current = setTimeout(() => {
        if (!readyRef.current && mountedRef.current) {
          console.warn('[Player] Timeout — retrying');
          markError();
        }
      }, TIMEOUT_MS);

      function reinit() {
        destroyHls();
        if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch {} }
        if (mountedRef.current) {
          setReady(false); readyRef.current = false;
          setBuffering(true); setError(false); setBufProgress(0);
        }
        init();
      }

      async function init() {
        if (srcRef.current !== src) return;
        try {
          const { default: Hls } = await import('hls.js');
          destroyHls();

          if (Hls.isSupported()) {
            const abrEstimate = qualityToInitialBitrate(networkQuality);

            const hls = new Hls({
              // ── Startup ────────────────────────────────────────────────
              startLevel:          -1,        // auto
              autoLevelEnabled:    true,
              capLevelToPlayerSize: true,

              // ── ABR — conservative: don't over-reach on weak networks ──
              abrEwmaDefaultEstimate:  abrEstimate,
              abrEwmaFastLive:         3.0,
              abrEwmaSlowLive:         9.0,
              abrBandWidthFactor:      0.70,
              abrBandWidthUpFactor:    0.85,

              // ── Buffer — prioritise uninterrupted play ─────────────────
              maxBufferLength:        30,      // try to hold 30s ahead
              maxMaxBufferLength:     60,
              backBufferLength:       10,
              liveBackBufferLength:   0,
              maxBufferSize:          60 * 1000 * 1000,
              maxBufferHole:          0.5,
              highBufferWatchdogPeriod: 2,
              nudgeMaxRetry:          20,
              nudgeOffset:            0.15,

              // ── Loading ────────────────────────────────────────────────
              maxLoadingDelay:        4,
              enableWorker:           true,
              progressive:            true,
              startFragPrefetch:      true,
              testBandwidth:          true,
              autoStartLoad:          true,
              lowLatencyMode:         false,

              // ── Retries ────────────────────────────────────────────────
              manifestLoadingMaxRetry:      8,
              manifestLoadingRetryDelay:    500,
              manifestLoadingMaxRetryTimeout: 15_000,
              levelLoadingMaxRetry:         8,
              levelLoadingRetryDelay:       500,
              levelLoadingMaxRetryTimeout:  15_000,
              fragLoadingMaxRetry:          10,
              fragLoadingRetryDelay:        500,
              fragLoadingMaxRetryTimeout:   15_000,

              xhrSetup: (xhr: XMLHttpRequest) => { xhr.timeout = 15_000; },
            });

            const entry = { destroy: () => { try { hls.destroy(); } catch {} }, src };
            hlsEntry.current = entry;
            registerHls(entry);
            hlsRef.current = hls;

            hls.loadSource(src);
            hls.attachMedia(video);

            // Muted background load
            video.muted   = true;
            video.preload = 'auto';

            hls.on(Hls.Events.MANIFEST_PARSED, (_: unknown, data: { levels: { height: number; bitrate: number }[] }) => {
              const lvls: QualityLevel[] = [
                { level: -1, height: 0, bitrate: 0, label: 'Auto' },
                ...data.levels.map((l, i) => ({
                  level:   i,
                  height:  l.height  || 0,
                  bitrate: l.bitrate || 0,
                  label:   l.height  ? `${l.height}p` : `Q${i + 1}`,
                })).reverse(),
              ];
              setQualities(lvls);
              startBufPoll();
            });

            hls.on(Hls.Events.FRAG_LOADED, () => {
              if (!readyRef.current && mountedRef.current) markReady();
              if (mountedRef.current) setBuffering(false);
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_: unknown, d: { level: number }) => {
              if (mountedRef.current) setCurrentLvl(d.level);
            });

            hls.on(Hls.Events.ERROR, (_: unknown, d: { fatal: boolean; type: string; details: string }) => {
              if (!mountedRef.current) return;
              if (d.fatal) {
                console.warn('[HLS] Fatal error:', d.type, d.details);
                if (d.type === 'mediaError') {
                  try { hls.recoverMediaError(); } catch { markError(); }
                } else {
                  markError();
                }
              } else {
                if (d.details === 'bufferStalledError' || d.details === 'bufferNudgeOnStall') {
                  setStallCount(c => c + 1);
                  clearTimeout(stallTimer.current);
                  stallTimer.current = setTimeout(() => {
                    if (video && !video.paused && mountedRef.current) {
                      try { video.currentTime += 0.3; } catch {}
                    }
                  }, 200);
                }
              }
            });

          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src     = src;
            video.preload = 'auto';
            video.onloadedmetadata = markReady;
            video.onerror          = markError;
            startBufPoll();
          } else {
            video.src     = src;
            video.preload = 'auto';
            video.oncanplay = markReady;
            video.onerror   = markError;
          }

          video.onwaiting = () => { if (mountedRef.current) setBuffering(true); };
          video.onplaying = () => { if (mountedRef.current) setBuffering(false); };
          video.onstalled = () => {
            if (!mountedRef.current) return;
            setBuffering(true);
            if (hlsRef.current) {
              try { hlsRef.current.recoverMediaError(); } catch {}
            }
          };
          video.onpause = () => {};
          video.onended = () => {
            // Live stream ended? Retry
            if (mountedRef.current && isActive) {
              setTimeout(() => { if (mountedRef.current) reinit(); }, 2000);
            }
          };

        } catch (e) {
          console.error('[Player] init error:', e);
          markError();
        }
      }

      init();

      return () => {
        clearTimeout(timerRef.current);
        clearTimeout(retryRef.current);
        clearInterval(pollRef.current);
        clearTimeout(stallTimer.current);
        destroyHls();
        if (video) {
          try { video.pause(); video.removeAttribute('src'); video.load(); } catch {}
        }
        if (mountedRef.current) {
          setReady(false); readyRef.current = false;
          setBuffering(false); setBufProgress(0);
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, shouldLoad, networkQuality]);

    // Play/pause on active change
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !ready) return;
      if (isActive) {
        video.muted = muted;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, [isActive, ready, muted]);

    // Mute sync
    useEffect(() => {
      if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);

    // PiP events
    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      const enter = () => setPipActive(true);
      const leave = () => setPipActive(false);
      v.addEventListener('enterpictureinpicture', enter);
      v.addEventListener('leavepictureinpicture', leave);
      return () => { v.removeEventListener('enterpictureinpicture', enter); v.removeEventListener('leavepictureinpicture', leave); };
    }, []);

    // Fullscreen events
    useEffect(() => {
      const onChange = () => { const fs = !!document.fullscreenElement; setFullscreen(fs); };
      document.addEventListener('fullscreenchange', onChange);
      return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const handlePiP = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (document.pictureInPictureElement) await document.exitPictureInPicture().catch(() => {});
      else await videoRef.current?.requestPictureInPicture().catch(() => {});
    };

    const handleFullscreen = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!wrapRef.current) return;
      if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); }
      else {
        await wrapRef.current.requestFullscreen().catch(() => {});
        try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'); } catch {}
      }
    };

    const handleQuality = useCallback((level: number) => {
      if (hlsRef.current) { hlsRef.current.currentLevel = level; hlsRef.current.nextLevel = level; }
      setCurrentLvl(level);
      setShowQuality(false);
    }, []);

    const handleRetry = (e: React.MouseEvent) => {
      e.stopPropagation();
      retryCount.current = 0;
      setError(false); setBuffering(true); setReady(false); setBufProgress(0);
      readyRef.current = false;
    };

    const qualLabel = qualities.find(q => q.level === currentLvl)?.label ?? 'Auto';
    const netColor  = networkQuality === 'fast' ? 'text-green-400' : networkQuality === 'medium' ? 'text-yellow-400' : 'text-red-400';

    return (
      <div ref={wrapRef}
        className="absolute inset-0 bg-black cursor-pointer select-none"
        onClick={() => { setMuted(m => !m); setShowQuality(false); setShowSleep(false); }}>

        <video ref={videoRef}
          className="w-full h-full object-contain bg-black"
          muted={muted} playsInline loop={false} preload="auto" tabIndex={0} />

        {/* ── Pre-buffer splash ── */}
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
            {channelLogo && (
              <div className="absolute inset-0">
                <img src={channelLogo} alt="" className="w-full h-full object-cover opacity-5 scale-150 blur-3xl" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
              </div>
            )}
            <div className="relative z-10 flex flex-col items-center gap-5 px-6">
              {/* Logo with pulse */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-white/8 border border-white/12 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                  {channelLogo
                    ? <img src={channelLogo} alt={channelName} className="w-full h-full object-contain p-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <span className="text-white/50 text-3xl font-bold">{channelName.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/40 animate-ping" />
              </div>

              <div className="text-center">
                <p className="text-white font-bold text-base leading-tight">{channelName}</p>
                <div className="flex items-center gap-1.5 justify-center mt-1">
                  <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                  <span className="text-red-400 text-xs font-bold tracking-wide">LIVE</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 w-48">
                <BufferWave progress={bufProgress} />
                <p className="text-white/30 text-xs text-center">
                  {bufProgress > 0
                    ? `Buffering ${Math.round(bufProgress * 100)}%…`
                    : retryCount.current > 0
                      ? `Retrying ${retryCount.current}/${MAX_RETRIES}…`
                      : 'Connecting…'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── In-stream buffering ring (non-intrusive) ── */}
        {buffering && ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full"
                style={{ border: '2px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(254,44,85,0.85)', animation: 'spin 0.7s linear infinite' }} />
              <div className="absolute inset-1.5 rounded-full"
                style={{ border: '2px solid rgba(255,255,255,0.04)', borderBottomColor: 'rgba(255,255,255,0.25)', animation: 'spin 1.3s linear infinite reverse' }} />
            </div>
          </div>
        )}

        {/* Sleep countdown */}
        {sleepTimer.active && sleepTimer.remaining > 0 && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-start pb-28 pl-4">
            <div className="flex items-center gap-2 bg-indigo-900/70 backdrop-blur px-3 py-1.5 rounded-full border border-indigo-500/40">
              <Moon className="w-3.5 h-3.5 text-indigo-300" />
              <span className="text-indigo-200 text-[11px] font-bold">
                Sleep {Math.floor(sleepTimer.remaining / 60)}:{String(sleepTimer.remaining % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="bg-black/85 backdrop-blur-xl rounded-3xl p-8 flex flex-col items-center gap-4 border border-white/10 mx-6">
              <WifiOff className="w-8 h-8 text-red-400/60" />
              <div className="text-center">
                <p className="text-white font-semibold text-sm">Stream unavailable</p>
                <p className="text-white/30 text-xs mt-1">Channel may be offline</p>
              </div>
              <button onClick={handleRetry}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          </div>
        )}

        {/* Mute badge */}
        <div className="absolute top-16 right-4 pointer-events-none">
          <div className="bg-black/50 backdrop-blur rounded-full p-1.5 border border-white/10">
            {muted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4 text-white/70" />}
          </div>
        </div>

        {/* LIVE badge */}
        {ready && !error && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-md border border-red-400/20">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}

        {/* Network badge */}
        {ready && !error && networkQuality !== 'unknown' && (
          <div className="absolute top-4 left-20 pointer-events-none">
            <div className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm border border-white/10', netColor)}>
              {networkQuality === 'fast' ? 'HD' : networkQuality === 'medium' ? 'SD' : 'LQ'}
            </div>
          </div>
        )}

        {/* Stall warning */}
        {stallCount >= 3 && ready && (
          <div className="absolute bottom-28 left-4 text-[10px] text-yellow-400/60 pointer-events-none">
            Recovering…
          </div>
        )}

        {/* Controls: quality + sleep + fs + pip */}
        {ready && !error && (
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {qualities.length > 1 && (
              <div className="relative">
                <button onClick={e => { e.stopPropagation(); setShowQuality(v => !v); setShowSleep(false); }}
                  className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1.5 rounded-lg hover:bg-black/80 transition-colors border border-white/10">
                  <Settings2 className="w-3 h-3" /> {qualLabel}
                </button>
                {showQuality && (
                  <div className="absolute top-full right-0 mt-1 bg-black/95 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden min-w-[110px] z-50 shadow-2xl"
                    onClick={e => e.stopPropagation()}>
                    {qualities.map(q => (
                      <button key={q.level} onClick={() => handleQuality(q.level)}
                        className={cn('w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-white/10 transition-colors border-b border-white/5 last:border-0',
                          q.level === currentLvl ? 'text-primary font-semibold' : 'text-white/80')}>
                        <span>{q.label}</span>
                        {q.bitrate > 0 && <span className="text-white/30 text-[10px]">{Math.round(q.bitrate / 1000)}k</span>}
                        {q.level === currentLvl && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={e => { e.stopPropagation(); setShowSleep(v => !v); setShowQuality(false); }}
              className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all border',
                sleepTimer.active ? 'bg-indigo-600 border-indigo-400/50' : 'bg-black/60 backdrop-blur-sm border-white/10 hover:bg-black/80')}>
              <Moon className="w-4 h-4 text-white" />
            </button>

            {fsSupported && (
              <button onClick={handleFullscreen}
                className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all border',
                  fullscreen ? 'bg-primary border-primary/50' : 'bg-black/60 backdrop-blur-sm border-white/10 hover:bg-black/80')}>
                {fullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
              </button>
            )}

            {pipSupported && (
              <button onClick={handlePiP}
                className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all border',
                  pipActive ? 'bg-primary border-primary/50' : 'bg-black/60 backdrop-blur-sm border-white/10 hover:bg-black/80')}>
                <PictureInPicture2 className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        )}

        {showSleep && <SleepTimerOverlay timer={sleepTimer} onClose={() => setShowSleep(false)} />}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
