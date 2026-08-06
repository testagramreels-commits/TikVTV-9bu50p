import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  Volume2, VolumeX, WifiOff, RefreshCw, PictureInPicture2,
  Settings2, Check, Maximize2, Minimize2, Moon,
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

// Per-source HLS instance limit: destroy old ones if above threshold
const MAX_HLS_INSTANCES = 5;
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

const MAX_RETRIES = 4;
const TIMEOUT_MS  = 18_000;

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ src, isActive, shouldLoad, channelName, channelLogo, onError, onReady }, ref) => {
    const videoRef    = useRef<HTMLVideoElement>(null);
    const wrapRef     = useRef<HTMLDivElement>(null);
    const hlsRef      = useRef<{ destroy: () => void; currentLevel: number; nextLevel: number; recoverMediaError: () => void } | null>(null);
    const timerRef    = useRef<ReturnType<typeof setTimeout>>();
    const retryTimer  = useRef<ReturnType<typeof setTimeout>>();
    const readyRef    = useRef(false);
    const retryCount  = useRef(0);
    const mountedRef  = useRef(true);

    const [muted,       setMuted]       = useState(true);
    const [error,       setError]       = useState(false);
    const [buffering,   setBuffering]   = useState(false);
    const [ready,       setReady]       = useState(false);
    const [pipActive,   setPipActive]   = useState(false);
    const [fullscreen,  setFullscreen]  = useState(false);
    const [qualities,   setQualities]   = useState<QualityLevel[]>([]);
    const [currentLvl,  setCurrentLvl]  = useState<number>(-1);
    const [showQuality, setShowQuality] = useState(false);
    const [showSleep,   setShowSleep]   = useState(false);
    const [stallCount,  setStallCount]  = useState(0);

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

    // ── HLS init with ABR + network-tolerant buffer ───────────────────────
    useEffect(() => {
      if (!shouldLoad || !src) return;
      const video = videoRef.current;
      if (!video) return;

      if (mountedRef.current) {
        setError(false); setReady(false); setBuffering(true);
        setQualities([]); setCurrentLvl(-1); setStallCount(0);
      }
      readyRef.current = false;

      const destroyHls = () => {
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
        if (isActive) video.play().catch(() => {});
      };

      const markError = () => {
        clearTimeout(timerRef.current);
        if (!mountedRef.current) return;
        if (retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          const delay = Math.min(1000 * retryCount.current, 4000);
          console.log(`[Player] Retry ${retryCount.current}/${MAX_RETRIES} in ${delay}ms`);
          setBuffering(true);
          retryTimer.current = setTimeout(reinit, delay);
        } else {
          setError(true); setBuffering(false); onError?.();
        }
      };

      // Watchdog timeout
      timerRef.current = setTimeout(() => {
        if (!readyRef.current && mountedRef.current) markError();
      }, TIMEOUT_MS);

      function reinit() {
        destroyHls();
        if (video) { video.pause(); video.src = ''; }
        if (mountedRef.current) { setReady(false); readyRef.current = false; setBuffering(true); setError(false); }
        init();
      }

      async function init() {
        try {
          const { default: Hls } = await import('hls.js');
          destroyHls();

          const abrEstimate = qualityToInitialBitrate(networkQuality);

          if (Hls.isSupported()) {
            const hls = new Hls({
              // ABR — adaptive quality
              startLevel:              -1,
              abrEwmaDefaultEstimate:  abrEstimate,
              abrEwmaFastLive:         3.0,
              abrEwmaSlowLive:         9.0,
              abrBandWidthFactor:      0.85,
              abrBandWidthUpFactor:    0.65,
              maxLoadingDelay:         4,

              // Pre-buffer — YouTube/TikTok-like smooth playback
              maxBufferLength:         45,
              maxMaxBufferLength:      90,
              maxBufferSize:           60 * 1000 * 1000, // 60MB
              maxBufferHole:           0.5,
              nudgeMaxRetry:           10,
              nudgeOffset:             0.3,
              highBufferWatchdogPeriod: 2,

              // Network tolerance
              enableWorker:            true,
              progressive:             true,
              startFragPrefetch:       true,
              testBandwidth:           true,
              autoStartLoad:           true,
              lowLatencyMode:          false,

              // Retry on all error types
              manifestLoadingMaxRetry:        4,
              manifestLoadingRetryDelay:      1000,
              manifestLoadingMaxRetryTimeout: 15000,
              levelLoadingMaxRetry:           4,
              levelLoadingRetryDelay:         1000,
              levelLoadingMaxRetryTimeout:    10000,
              fragLoadingMaxRetry:            4,
              fragLoadingRetryDelay:          1000,
              fragLoadingMaxRetryTimeout:     10000,

              xhrSetup: (xhr) => { xhr.timeout = 12000; },
            });

            // Register to cap concurrent instances
            registerHls(hls as unknown as { destroy: () => void });
            hlsRef.current = hls as unknown as typeof hlsRef.current;

            hls.loadSource(src);
            hls.attachMedia(video);

            // Manifest parsed — extract quality levels
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
              markReady();
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_: unknown, data: { level: number }) => {
              if (mountedRef.current) setCurrentLvl(data.level);
            });

            hls.on(Hls.Events.FRAG_BUFFERED, () => {
              if (mountedRef.current) setBuffering(false);
            });

            hls.on(Hls.Events.ERROR, (_: unknown, d: { fatal: boolean; type: string; details: string }) => {
              if (d.fatal) {
                // Fatal: try media error recovery once, then full reinit
                if (d.type === 'mediaError') {
                  try { hls.recoverMediaError(); } catch { markError(); }
                } else {
                  markError();
                }
              } else {
                // Non-fatal stall: nudge
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
        destroyHls();
        if (video) { video.pause(); video.src = ''; video.load(); }
        if (mountedRef.current) { setReady(false); readyRef.current = false; setBuffering(false); }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, shouldLoad, networkQuality]);

    // ── Play/pause ────────────────────────────────────────────────────────
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !ready) return;
      if (isActive) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, [isActive, ready]);

    // ── Mute sync ─────────────────────────────────────────────────────────
    useEffect(() => {
      if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);

    // ── PiP events ────────────────────────────────────────────────────────
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

    // ── Fullscreen events ─────────────────────────────────────────────────
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
        try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'); } catch {}
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
      setError(false); setBuffering(true); setReady(false);
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
        {/* Video */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          muted={muted}
          playsInline
          loop={false}
          preload="auto"
          tabIndex={0}
        />

        {/* Placeholder while loading */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
            {channelLogo ? (
              <img src={channelLogo} alt={channelName}
                className="w-28 h-28 object-contain opacity-30"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
                <span className="text-white text-4xl font-bold">{channelName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
        )}

        {/* Buffering spinner */}
        {buffering && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full"
                style={{ border: '3px solid rgba(255,255,255,0.12)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
              {retryCount.current > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/60 text-[9px] font-bold">{retryCount.current}</span>
                </div>
              )}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="bg-black/70 backdrop-blur rounded-2xl p-6 flex flex-col items-center gap-3">
              <WifiOff className="w-9 h-9 text-white/40" />
              <p className="text-white/50 text-sm">Stream unavailable</p>
              <button
                className="pointer-events-auto flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-sm px-4 py-2 rounded-full transition-colors"
                onClick={handleRetry}
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Mute indicator */}
        <div className="absolute top-16 right-4 pointer-events-none">
          <div className="bg-black/50 backdrop-blur rounded-full p-1.5">
            {muted ? <VolumeX className="w-4 h-4 text-white/80" /> : <Volume2 className="w-4 h-4 text-white/80" />}
          </div>
        </div>

        {/* LIVE badge */}
        {ready && !error && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-md">
            <div className="w-1.5 h-1.5 bg-white rounded-full live-dot" />
            LIVE
          </div>
        )}

        {/* Network quality badge */}
        {ready && !error && networkQuality !== 'unknown' && (
          <div className="absolute top-4 left-20 pointer-events-none">
            <div className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40', networkColor)}>
              {networkQuality === 'fast' ? 'HD' : networkQuality === 'medium' ? 'SD' : 'LQ'}
            </div>
          </div>
        )}

        {/* Stall warning */}
        {stallCount >= 3 && ready && (
          <div className="absolute bottom-28 left-4 text-[10px] text-yellow-400/60 pointer-events-none">
            Recovering ({stallCount})
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
                  className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1.5 rounded-lg hover:bg-black/70 transition-colors"
                >
                  <Settings2 className="w-3 h-3" /> {currentQualityLabel}
                </button>
                {showQuality && (
                  <div
                    className="absolute top-full right-0 mt-1 bg-black/90 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden min-w-[110px] z-50"
                    onClick={e => e.stopPropagation()}
                  >
                    {qualities.map(q => (
                      <button key={q.level} onClick={() => handleQualityChange(q.level)}
                        className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors',
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
              className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all',
                sleepTimer.active ? 'bg-indigo-600' : 'bg-black/50 hover:bg-black/70 backdrop-blur-sm')}
            >
              <Moon className="w-4 h-4 text-white" />
            </button>

            {/* Fullscreen */}
            {fsSupported && (
              <button
                onClick={handleFullscreen}
                className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  fullscreen ? 'bg-primary' : 'bg-black/50 hover:bg-black/70 backdrop-blur-sm')}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
              </button>
            )}

            {/* PiP */}
            {pipSupported && (
              <button
                onClick={handlePiP}
                className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  pipActive ? 'bg-primary' : 'bg-black/50 hover:bg-black/70 backdrop-blur-sm')}
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
