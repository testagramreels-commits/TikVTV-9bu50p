/**
 * VideoPlayer — background-first streaming strategy.
 * Preloads HLS stream silently in the background so when the user arrives
 * the stream is already buffered (target: ≥30s pre-buffer before playback).
 * Shows a cinematic waveform loading animation while buffering.
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
  shouldLoad:   boolean;   // true = preload in background
  channelName:  string;
  channelLogo?: string;
  onError?:     () => void;
  onReady?:     () => void;
}

// Per-source HLS instance limit
const MAX_HLS_INSTANCES = 6;
const activeHlsInstances = new Set<{ destroy: () => void }>();

function registerHls(hls: { destroy: () => void }) {
  activeHlsInstances.add(hls);
  if (activeHlsInstances.size > MAX_HLS_INSTANCES) {
    const oldest = activeHlsInstances.values().next().value;
    if (oldest) { oldest.destroy(); activeHlsInstances.delete(oldest); }
  }
}
function unregisterHls(hls: { destroy: () => void }) {
  activeHlsInstances.delete(hls);
}

const MAX_RETRIES = 5;
const TIMEOUT_MS  = 30_000;   // 30s timeout matches the pre-buffer goal

// Buffer progress animation bars
function BufferWaveform({ progress }: { progress: number }) {
  const bars = 20;
  return (
    <div className="flex items-end gap-[2px] h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const filled = i / bars < progress;
        const height = 8 + Math.sin((i / bars) * Math.PI * 2) * 10 + 8;
        return (
          <div
            key={i}
            className={cn(
              'w-[3px] rounded-full transition-all duration-300',
              filled
                ? 'bg-gradient-to-t from-primary to-primary/40'
                : 'bg-white/12'
            )}
            style={{
              height: `${filled ? height : 4}px`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ src, isActive, shouldLoad, channelName, channelLogo, onError, onReady }, ref) => {
    const videoRef    = useRef<HTMLVideoElement>(null);
    const wrapRef     = useRef<HTMLDivElement>(null);
    const hlsRef      = useRef<{
      destroy: () => void;
      currentLevel: number;
      nextLevel: number;
      recoverMediaError: () => void;
    } | null>(null);
    const timerRef    = useRef<ReturnType<typeof setTimeout>>();
    const retryTimer  = useRef<ReturnType<typeof setTimeout>>();
    const readyRef    = useRef(false);
    const retryCount  = useRef(0);
    const mountedRef  = useRef(true);
    const bufferPollRef = useRef<ReturnType<typeof setInterval>>();

    const [muted,         setMuted]         = useState(true);
    const [error,         setError]         = useState(false);
    const [buffering,     setBuffering]     = useState(false);
    const [ready,         setReady]         = useState(false);
    const [bufferProgress, setBufferProgress] = useState(0);  // 0–1 pre-buffer fill
    const [pipActive,     setPipActive]     = useState(false);
    const [fullscreen,    setFullscreen]    = useState(false);
    const [qualities,     setQualities]     = useState<QualityLevel[]>([]);
    const [currentLvl,    setCurrentLvl]    = useState<number>(-1);
    const [showQuality,   setShowQuality]   = useState(false);
    const [showSleep,     setShowSleep]     = useState(false);
    const [stallCount,    setStallCount]    = useState(0);

    const networkQuality = useNetworkQuality();
    const pipSupported   = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;
    const fsSupported    = typeof document !== 'undefined' && 'fullscreenEnabled' in document;

    const sleepTimer = useSleepTimer(() => {
      videoRef.current?.pause();
    });

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

    // Poll buffer level for smooth progress indicator
    const startBufferPoll = useCallback(() => {
      clearInterval(bufferPollRef.current);
      const TARGET_BUFFER = 30; // seconds
      bufferPollRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || !mountedRef.current) return;
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const current = video.currentTime;
          const ahead = Math.max(0, bufferedEnd - current);
          setBufferProgress(Math.min(1, ahead / TARGET_BUFFER));
          if (ahead >= TARGET_BUFFER * 0.8 && !readyRef.current) {
            // Pre-buffer threshold met
          }
        }
      }, 500);
    }, []);

    // ── HLS init with background-first strategy ────────────────────────
    useEffect(() => {
      if (!shouldLoad || !src) return;
      const video = videoRef.current;
      if (!video) return;

      if (mountedRef.current) {
        setError(false); setReady(false); setBuffering(true);
        setQualities([]); setCurrentLvl(-1); setStallCount(0);
        setBufferProgress(0);
      }
      readyRef.current = false;

      const destroyHls = () => {
        clearInterval(bufferPollRef.current);
        if (hlsRef.current) {
          unregisterHls(hlsRef.current);
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };

      const markReady = () => {
        clearTimeout(timerRef.current);
        if (!mountedRef.current) return;
        readyRef.current = true;
        setReady(true); setBuffering(false);
        retryCount.current = 0;
        onReady?.();
        // Only autoplay if this card is active
        if (isActive) video.play().catch(() => {});
      };

      const markError = () => {
        clearTimeout(timerRef.current);
        if (!mountedRef.current) return;
        if (retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          const delay = Math.min(2000 * retryCount.current, 8000);
          console.log(`[Player] Retry ${retryCount.current}/${MAX_RETRIES} in ${delay}ms`);
          setBuffering(true);
          retryTimer.current = setTimeout(reinit, delay);
        } else {
          setError(true); setBuffering(false); onError?.();
        }
      };

      // 30s watchdog — matches pre-buffer goal
      timerRef.current = setTimeout(() => {
        if (!readyRef.current && mountedRef.current) markError();
      }, TIMEOUT_MS);

      function reinit() {
        destroyHls();
        if (video) { video.pause(); video.src = ''; }
        if (mountedRef.current) {
          setReady(false); readyRef.current = false;
          setBuffering(true); setError(false); setBufferProgress(0);
        }
        init();
      }

      async function init() {
        try {
          const { default: Hls } = await import('hls.js');
          destroyHls();

          const abrEstimate = qualityToInitialBitrate(networkQuality);

          if (Hls.isSupported()) {const hls = new Hls({
          // ── Adaptive Bitrate (Auto Resolution) ─────────────────────────────
          startLevel: -1,
          autoLevelEnabled: true,
          capLevelToPlayerSize: true,

          abrEwmaDefaultEstimate: abrEstimate,
          abrEwmaFastLive: 2.0,
          abrEwmaSlowLive: 5.0,
          abrBandWidthFactor: 0.75,
          abrBandWidthUpFactor: 0.90,
          maxLoadingDelay: 3,

          // ── Faster Startup & Smaller Buffer ────────────────────────────────
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          backBufferLength: 8,
          liveBackBufferLength: 0,
          maxBufferSize: 40 * 1000 * 1000,
          maxBufferHole: 0.3,

          // ── Better Recovery ────────────────────────────────────────────────
           nudgeMaxRetry: 20,
           nudgeOffset: 0.1,
           highBufferWatchdogPeriod: 1,

          // ── Streaming ──────────────────────────────────────────────────────
           enableWorker: true,
           progressive: true,
           startFragPrefetch: true,
           testBandwidth: true,
           autoStartLoad: true,
           lowLatencyMode: false,

            // ── Retry Logic ────────────────────────────────────────────────────
            manifestLoadingMaxRetry: 6,
            manifestLoadingRetryDelay: 500,
            manifestLoadingMaxRetryTimeout: 10000,

            levelLoadingMaxRetry: 6,
            levelLoadingRetryDelay: 500,
            levelLoadingMaxRetryTimeout: 10000,

            fragLoadingMaxRetry: 8,
            fragLoadingRetryDelay: 500,
            fragLoadingMaxRetryTimeout: 10000,

            xhrSetup: (xhr) => {
            xhr.timeout = 10000;
            },
            }); 
            

            registerHls(hls as unknown as { destroy: () => void });
            hlsRef.current = hls as unknown as typeof hlsRef.current;

            hls.loadSource(src);
            hls.attachMedia(video);

            // Background: mute + pause until active
            video.muted = true;
            video.pause();

            hls.on(Hls.Events.MANIFEST_PARSED, (_: unknown, data: { levels: { height: number; bitrate: number }[] }) => {
              const lvls: QualityLevel[] = [
                { level: -1, height: 0, bitrate: 0, label: 'Auto' },
                ...data.levels.map((l, i) => ({
                  level:   i,
                  height:  l.height || 0,
                  bitrate: l.bitrate || 0,
                  label:   l.height ? `${l.height}p` : `L${i + 1}`,
                })).reverse(),
              ];
              setQualities(lvls);
              startBufferPoll();
              // Don't markReady until we have enough buffer
            });

            // Mark ready once first fragment is loaded (ensures stream is actually playable)
            hls.on(Hls.Events.FRAG_LOADED, () => {
              if (!readyRef.current) markReady();
              if (mountedRef.current) setBuffering(false);
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_: unknown, data: { level: number }) => {
              if (mountedRef.current) setCurrentLvl(data.level);
            });

            hls.on(Hls.Events.ERROR, (_: unknown, d: { fatal: boolean; type: string; details: string }) => {
              if (d.fatal) {
                if (d.type === 'mediaError') {
                  try { hls.recoverMediaError(); } catch { markError(); }
                } else {
                  markError();
                }
              } else {
                if (d.details === 'bufferStalledError' || d.details === 'bufferNudgeOnStall') {
                  setStallCount(c => c + 1);
                  if (video && !video.paused) {
                    try { video.currentTime += 0.2; } catch {}
                  }
                }
              }
            });

          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            video.preload = 'auto';
            video.onloadedmetadata = markReady;
            video.onerror = markError;
          } else {
            video.src = src;
            video.preload = 'auto';
            video.oncanplay = markReady;
            video.onerror = markError;
          }

          video.onwaiting = () => { if (mountedRef.current) setBuffering(true); };
          video.onplaying = () => { if (mountedRef.current) setBuffering(false); };
          video.onstalled = () => {
            if (mountedRef.current) setBuffering(true);
            if (hlsRef.current) try { hlsRef.current.recoverMediaError(); } catch {}
          };

        } catch (e) {
          console.error('[Player] init error:', e);
          markError();
        }
      }

      init();

      return () => {
        clearTimeout(timerRef.current);
        clearTimeout(retryTimer.current);
        clearInterval(bufferPollRef.current);
        destroyHls();
        if (video) { video.pause(); video.src = ''; video.load(); }
        if (mountedRef.current) {
          setReady(false); readyRef.current = false;
          setBuffering(false); setBufferProgress(0);
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, shouldLoad, networkQuality]);

    // ── Play/pause based on active state ─────────────────────────────
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !ready) return;
      if (isActive) {
        video.muted = muted;
        video.play().catch(() => {});
      } else {
        // Keep buffering in background but pause playback
        video.pause();
      }
    }, [isActive, ready, muted]);

    // ── Mute sync ─────────────────────────────────────────────────────
    useEffect(() => {
      if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);

    // ── PiP events ────────────────────────────────────────────────────
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const onEnter = () => setPipActive(true);
      const onLeave = () => setPipActive(false);
      video.addEventListener('enterpictureinpicture', onEnter);
      video.addEventListener('leavepictureinpicture', onLeave);
      return () => {
        video.removeEventListener('enterpictureinpicture', onEnter);
        video.removeEventListener('leavepictureinpicture', onLeave);
      };
    }, []);

    // ── Fullscreen events ─────────────────────────────────────────────
    useEffect(() => {
      const onChange = () => {
        const isFs = !!document.fullscreenElement;
        setFullscreen(isFs);
        if (!isFs) screen.orientation?.unlock?.();
      };
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
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
        screen.orientation?.unlock?.();
      } else {
        await wrapRef.current.requestFullscreen().catch(() => {});
        try {
          await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape');
        } catch {}
      }
    };

    const handleQualityChange = useCallback((level: number) => {
      if (hlsRef.current) { hlsRef.current.currentLevel = level; hlsRef.current.nextLevel = level; }
      setCurrentLvl(level);
      setShowQuality(false);
    }, []);

    const handleRetry = (e: React.MouseEvent) => {
      e.stopPropagation();
      retryCount.current = 0;
      setError(false); setBuffering(true); setReady(false); setBufferProgress(0);
      readyRef.current = false;
    };

    const currentQualityLabel = qualities.find(q => q.level === currentLvl)?.label ?? 'Auto';
    const networkColor = networkQuality === 'fast' ? 'text-green-400' :
                         networkQuality === 'medium' ? 'text-yellow-400' : 'text-red-400';

    return (
      <div
        ref={wrapRef}
        className="absolute inset-0 bg-black cursor-pointer select-none"
        onClick={() => { setMuted(m => !m); setShowQuality(false); setShowSleep(false); }}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          muted={muted}
          playsInline
          loop={false}
          preload="auto"
          tabIndex={0}
        />

        {/* ── Cinematic pre-buffer splash ──────────────────────────────── */}
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
            {/* Blurred logo background */}
            {channelLogo && (
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={channelLogo}
                  alt=""
                  className="w-full h-full object-cover opacity-8 scale-150 blur-3xl"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
              </div>
            )}

            {/* Center content */}
            <div className="relative z-10 flex flex-col items-center gap-5">
              {/* Channel logo */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-white/8 border border-white/12 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                  {channelLogo ? (
                    <img
                      src={channelLogo}
                      alt={channelName}
                      className="w-full h-full object-contain p-2"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-white/50 text-3xl font-bold">
                      {channelName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Pulsing ring */}
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
              </div>

              {/* Channel name */}
              <div className="text-center">
                <p className="text-white font-bold text-lg leading-tight">{channelName}</p>
                <div className="flex items-center gap-1.5 justify-center mt-1">
                  <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                  <span className="text-red-400 text-xs font-bold">LIVE</span>
                </div>
              </div>

              {/* Waveform buffer indicator */}
              {!error && (
                <div className="flex flex-col items-center gap-2">
                  <BufferWaveform progress={bufferProgress} />
                  <p className="text-white/30 text-xs">
                    {bufferProgress > 0
                      ? `Buffering ${Math.round(bufferProgress * 100)}%…`
                      : retryCount.current > 0
                        ? `Retrying (${retryCount.current}/${MAX_RETRIES})…`
                        : 'Connecting to stream…'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── In-stream buffering spinner (small, non-intrusive) ────────── */}
        {buffering && ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-12 h-12">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '2px solid rgba(255,255,255,0.10)',
                  borderTopColor: 'rgba(254,44,85,0.8)',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              {/* Inner ring */}
              <div
                className="absolute inset-1.5 rounded-full"
                style={{
                  border: '2px solid rgba(255,255,255,0.05)',
                  borderBottomColor: 'rgba(255,255,255,0.3)',
                  animation: 'spin 1.4s linear infinite reverse',
                }}
              />
            </div>
          </div>
        )}

        {/* Sleep timer countdown ring */}
        {sleepTimer.active && sleepTimer.remaining > 0 && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-start pb-28 pl-4">
            <div className="flex items-center gap-2 bg-indigo-900/70 backdrop-blur px-3 py-1.5 rounded-full border border-indigo-500/40">
              <Moon className="w-3.5 h-3.5 text-indigo-300" />
              <span className="text-indigo-200 text-[11px] font-bold">
                Sleep in {Math.floor(sleepTimer.remaining / 60)}:{String(sleepTimer.remaining % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="bg-black/80 backdrop-blur-xl rounded-3xl p-8 flex flex-col items-center gap-4 border border-white/10 mx-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-red-400/60" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-sm">Stream unavailable</p>
                <p className="text-white/30 text-xs mt-1">The channel may be offline</p>
              </div>
              <button
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
                onClick={handleRetry}
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          </div>
        )}

        {/* Mute indicator pill */}
        <div className="absolute top-16 right-4 pointer-events-none">
          <div className="bg-black/50 backdrop-blur rounded-full p-1.5 border border-white/10">
            {muted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4 text-white/70" />}
          </div>
        </div>

        {/* LIVE badge */}
        {ready && !error && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-md border border-red-400/20">
            <div className="w-1.5 h-1.5 bg-white rounded-full live-dot" />
            LIVE
          </div>
        )}

        {/* Network quality badge */}
        {ready && !error && networkQuality !== 'unknown' && (
          <div className="absolute top-4 left-20 pointer-events-none">
            <div className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm border border-white/10', networkColor)}>
              {networkQuality === 'fast' ? 'HD' : networkQuality === 'medium' ? 'SD' : 'LQ'}
            </div>
          </div>
        )}

        {/* Stall recovery */}
        {stallCount >= 3 && ready && (
          <div className="absolute bottom-28 left-4 text-[10px] text-yellow-400/60 pointer-events-none">
            Recovering stream…
          </div>
        )}

        {/* Top-right controls */}
        {ready && !error && (
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {/* Quality selector */}
            {qualities.length > 1 && (
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setShowQuality(v => !v); setShowSleep(false); }}
                  className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1.5 rounded-lg hover:bg-black/80 transition-colors border border-white/10"
                >
                  <Settings2 className="w-3 h-3" /> {currentQualityLabel}
                </button>
                {showQuality && (
                  <div
                    className="absolute top-full right-0 mt-1 bg-black/95 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden min-w-[110px] z-50 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    {qualities.map(q => (
                      <button key={q.level} onClick={() => handleQualityChange(q.level)}
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

            {/* Sleep timer */}
            <button
              onClick={e => { e.stopPropagation(); setShowSleep(v => !v); setShowQuality(false); }}
              className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all border',
                sleepTimer.active
                  ? 'bg-indigo-600 border-indigo-400/50'
                  : 'bg-black/60 backdrop-blur-sm border-white/10 hover:bg-black/80')}
            >
              <Moon className="w-4 h-4 text-white" />
            </button>

            {/* Fullscreen */}
            {fsSupported && (
              <button
                onClick={handleFullscreen}
                className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all border',
                  fullscreen ? 'bg-primary border-primary/50' : 'bg-black/60 backdrop-blur-sm border-white/10 hover:bg-black/80')}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
              </button>
            )}

            {/* PiP */}
            {pipSupported && (
              <button
                onClick={handlePiP}
                className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all border',
                  pipActive ? 'bg-primary border-primary/50' : 'bg-black/60 backdrop-blur-sm border-white/10 hover:bg-black/80')}
              >
                <PictureInPicture2 className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        )}

        {/* Sleep timer overlay */}
        {showSleep && (
          <SleepTimerOverlay
            timer={sleepTimer}
            onClose={() => setShowSleep(false)}
          />
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
