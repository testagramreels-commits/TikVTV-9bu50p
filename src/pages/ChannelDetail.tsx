/**
 * ChannelDetail — full-screen channel page with:
 * - Full-height video player (top half)
 * - Channel lock + 15→0 min countdown (same as Feed)
 * - Premium paywall modal
 * - Reactions, favorites, comments
 * - Full safe-area awareness (no content hidden under status bar)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Globe,
  PictureInPicture2, Loader2, Wifi, Crown, Lock, Maximize2,
  Minimize2, Volume2, VolumeX, RefreshCw, WifiOff, Settings2, Check,
} from 'lucide-react';
import { fetchAllChannels, getChannelById } from '@/lib/iptvApi';
import { getCountryFlag, categoryColor, cn, formatCount, timeAgo } from '@/lib/utils';
import { useReactions } from '@/hooks/useReactions';
import { useFavorites } from '@/hooks/useFavorites';
import { useComments } from '@/hooks/useComments';
import { useChannelLock } from '@/hooks/useChannelLock';
import { useAuthStore } from '@/stores/authStore';
import AuthModal from '@/components/features/AuthModal';
import PremiumModal from '@/components/features/PremiumModal';
import type { IPTVChannel } from '@/types';
import { toast } from 'sonner';

// ── Minimal in-page HLS player (same config as VideoPlayer for buffering) ──
function InlinePlayer({
  src, channelName, channelLogo, locked,
}: {
  src: string; channelName: string; channelLogo?: string; locked: boolean;
}) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef    = useRef<any>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [ready,   setReady]   = useState(false);
  const [error,   setError]   = useState(false);
  const [muted,   setMuted]   = useState(false);
  const [buf,     setBuf]     = useState(false);
  const [fs,      setFs]      = useState(false);
  const [pip,     setPip]     = useState(false);
  const [quals,   setQuals]   = useState<{ level: number; label: string; bitrate: number }[]>([]);
  const [curLvl,  setCurLvl]  = useState(-1);
  const [showQ,   setShowQ]   = useState(false);
  const retries   = useRef(0);
  const MAX_RETRY = 6;

  const destroy = useCallback(() => {
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (videoRef.current) { try { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); } catch {} }
  }, []);

  const init = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !src) return;
    setReady(false); setError(false); setBuf(true);
    try {
      const { default: Hls } = await import('hls.js');
      destroy();
      if (Hls.isSupported()) {
        const hls = new Hls({
          startLevel: -1, autoLevelEnabled: true, capLevelToPlayerSize: true,
          abrEwmaDefaultEstimate: 1_000_000,
          abrBandWidthFactor: 0.70, abrBandWidthUpFactor: 0.85,
          maxBufferLength: 30, maxMaxBufferLength: 60,
          backBufferLength: 10, liveBackBufferLength: 0,
          maxBufferSize: 60 * 1000 * 1000, maxBufferHole: 0.5,
          nudgeMaxRetry: 20, nudgeOffset: 0.15,
          enableWorker: true, progressive: true,
          startFragPrefetch: true, autoStartLoad: true, lowLatencyMode: false,
          manifestLoadingMaxRetry: 8, manifestLoadingRetryDelay: 500,
          levelLoadingMaxRetry: 8, levelLoadingRetryDelay: 500,
          fragLoadingMaxRetry: 10, fragLoadingRetryDelay: 500,
          xhrSetup: (xhr: XMLHttpRequest) => { xhr.timeout = 15_000; },
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        video.muted = muted;
        video.preload = 'auto';

        hls.on(Hls.Events.MANIFEST_PARSED, (_: unknown, d: { levels: { height: number; bitrate: number }[] }) => {
          setQuals([
            { level: -1, label: 'Auto', bitrate: 0 },
            ...d.levels.map((l, i) => ({ level: i, label: l.height ? `${l.height}p` : `Q${i+1}`, bitrate: l.bitrate || 0 })).reverse(),
          ]);
          setReady(true); setBuf(false); retries.current = 0;
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.FRAG_LOADED, () => { if (!ready) { setReady(true); setBuf(false); } });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_: unknown, d: { level: number }) => setCurLvl(d.level));

        hls.on(Hls.Events.ERROR, (_: unknown, d: { fatal: boolean; type: string; details: string }) => {
          if (!d.fatal) {
            if (d.details === 'bufferStalledError') {
              try { if (video.currentTime) video.currentTime += 0.3; } catch {}
            }
            return;
          }
          if (d.type === 'mediaError') { try { hls.recoverMediaError(); } catch { tryRetry(); } }
          else tryRetry();
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src; video.preload = 'auto';
        video.onloadedmetadata = () => { setReady(true); setBuf(false); video.play().catch(() => {}); };
        video.onerror = () => tryRetry();
      }

      video.onwaiting = () => setBuf(true);
      video.onplaying = () => setBuf(false);
      video.onstalled = () => { setBuf(true); if (hlsRef.current) { try { hlsRef.current.recoverMediaError(); } catch {} } };

    } catch { tryRetry(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, muted]);

  function tryRetry() {
    if (retries.current < MAX_RETRY) {
      retries.current++;
      const delay = Math.min(1500 * retries.current, 10_000);
      setTimeout(() => init(), delay);
    } else { setError(true); setBuf(false); }
  }

  useEffect(() => { init(); return destroy; }, [src]);

  // Pause when locked
  useEffect(() => {
    if (locked && videoRef.current) videoRef.current.pause();
    else if (!locked && ready && videoRef.current) videoRef.current.play().catch(() => {});
  }, [locked, ready]);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);

  // Fullscreen events
  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // PiP events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const enter = () => setPip(true);
    const leave = () => setPip(false);
    v.addEventListener('enterpictureinpicture', enter);
    v.addEventListener('leavepictureinpicture', leave);
    return () => { v.removeEventListener('enterpictureinpicture', enter); v.removeEventListener('leavepictureinpicture', leave); };
  }, []);

  const handleFs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wrapRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else {
      await wrapRef.current.requestFullscreen().catch(() => {});
      try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'); } catch {}
    }
  };

  const handlePiP = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.pictureInPictureElement) await document.exitPictureInPicture().catch(() => {});
    else await videoRef.current?.requestPictureInPicture().catch(() => {});
  };

  const handleQuality = (level: number) => {
    if (hlsRef.current) { hlsRef.current.currentLevel = level; hlsRef.current.nextLevel = level; }
    setCurLvl(level); setShowQ(false);
  };

  const qualLabel = quals.find(q => q.level === curLvl)?.label ?? 'Auto';
  const fsSupported = typeof document !== 'undefined' && 'fullscreenEnabled' in document;
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;

  return (
    <div ref={wrapRef} className="relative w-full bg-black" style={{ aspectRatio: '16/9', minHeight: 200 }}
      onClick={() => { if (!locked) setMuted(m => !m); setShowQ(false); }}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        muted={muted} playsInline preload="auto"
      />

      {/* Buffering / loading */}
      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          {channelLogo && (
            <img src={channelLogo} alt="" className="absolute inset-0 w-full h-full object-cover opacity-5 scale-150 blur-3xl" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/8 border border-white/12 flex items-center justify-center overflow-hidden">
              {channelLogo
                ? <img src={channelLogo} alt={channelName} className="w-full h-full object-contain p-2" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                : <span className="text-white/50 text-2xl font-bold">{channelName.charAt(0)}</span>}
            </div>
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/40 text-xs">Buffering…</p>
          </div>
        </div>
      )}

      {/* In-stream buffer spinner */}
      {buf && ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-9 h-9 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
          <WifiOff className="w-8 h-8 text-red-400/50" />
          <p className="text-white/40 text-sm">Stream unavailable</p>
          <button onClick={e => { e.stopPropagation(); retries.current=0; init(); }}
            className="flex items-center gap-2 bg-white/10 text-white text-sm px-4 py-2 rounded-full">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* LIVE badge */}
      {ready && !error && !locked && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded pointer-events-none">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE
        </div>
      )}

      {/* Mute badge */}
      {ready && !locked && (
        <div className="absolute top-3 right-24 bg-black/50 backdrop-blur rounded-full p-1.5 pointer-events-none border border-white/10">
          {muted ? <VolumeX className="w-3.5 h-3.5 text-white/70" /> : <Volume2 className="w-3.5 h-3.5 text-white/70" />}
        </div>
      )}

      {/* Controls row */}
      {ready && !error && !locked && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {/* Quality picker */}
          {quals.length > 1 && (
            <div className="relative">
              <button onClick={() => setShowQ(v => !v)}
                className="flex items-center gap-1 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/10">
                <Settings2 className="w-3 h-3" /> {qualLabel}
              </button>
              {showQ && (
                <div className="absolute top-full right-0 mt-1 bg-black/95 backdrop-blur border border-white/15 rounded-xl overflow-hidden min-w-[100px] z-50 shadow-2xl">
                  {quals.map(q => (
                    <button key={q.level} onClick={() => handleQuality(q.level)}
                      className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-white/10 border-b border-white/5 last:border-0',
                        q.level === curLvl ? 'text-primary font-semibold' : 'text-white/80')}>
                      <span>{q.label}</span>
                      {q.level === curLvl && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {fsSupported && (
            <button onClick={handleFs}
              className={cn('w-8 h-8 rounded-full flex items-center justify-center border',
                fs ? 'bg-primary border-primary/50' : 'bg-black/60 backdrop-blur border-white/10')}>
              {fs ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
            </button>
          )}

          {pipSupported && (
            <button onClick={handlePiP}
              className={cn('w-8 h-8 rounded-full flex items-center justify-center border',
                pip ? 'bg-primary border-primary/50' : 'bg-black/60 backdrop-blur border-white/10')}>
              <PictureInPicture2 className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ChannelDetail() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const { user }    = useAuthStore();

  const [channel,     setChannel]     = useState<IPTVChannel | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showAuth,    setShowAuth]    = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [isReady,     setIsReady]     = useState(false); // triggers lock tracking
  const [commentText, setCommentText] = useState('');
  const [sending,     setSending]     = useState(false);

  const { liked, likeCount, toggleLike }           = useReactions(id || '', user?.id);
  const { isFavorite, toggleFavorite }             = useFavorites(user?.id);
  const { comments, count, fetchComments, addComment } = useComments(id || '');

  // Channel lock — same as Feed
  const { locked, watchedPercent, remainingSecs } = useChannelLock(id || '', true, isReady);

  // Start lock tracking once video is visible
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchAllChannels().then(() => {
      const ch = getChannelById(id);
      setChannel(ch || null);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (channel) fetchComments();
  }, [channel]);

  const handleShare = async () => {
    const url  = `${window.location.origin}/channel/${id}`;
    const text = `Watching ${channel?.name} live on TikVTV!`;
    if (navigator.share) navigator.share({ title: channel?.name, text, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success('Link copied!'); }
  };

  const handleLike = async () => {
    if (!user) { setShowAuth(true); return; }
    await toggleLike();
  };

  const handleFav = async () => {
    if (!user) { setShowAuth(true); return; }
    if (channel) await toggleFavorite(channel);
  };

  const handleSendComment = async () => {
    if (!user) { setShowAuth(true); return; }
    if (!commentText.trim() || sending) return;
    setSending(true);
    await addComment(commentText, user.id);
    setCommentText('');
    setSending(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
    </div>
  );

  if (!channel) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <Wifi className="w-12 h-12 text-white/20" />
      <p className="text-white/40">Channel not found</p>
      <button onClick={() => navigate(-1)} className="text-primary text-sm">← Go back</button>
    </div>
  );

  const flag = getCountryFlag(channel.countryCode);
  const faved = isFavorite(channel.id);

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* ── Back bar (safe area aware) ── */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 pt-12 pb-3 bg-black/90 backdrop-blur border-b border-white/8">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-semibold text-sm truncate flex-1">{channel.name}</h1>

        {/* Live badge */}
        <div className="flex items-center gap-1.5 bg-red-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE
        </div>
      </div>

      {/* ── Video player ── */}
      <div className="relative">
        <InlinePlayer
          src={channel.streamUrl}
          channelName={channel.name}
          channelLogo={channel.logo}
          locked={locked}
        />

        {/* Lock overlay over video */}
        {locked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-4 px-8 text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Lock className="w-10 h-10 text-amber-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-1">Channel Locked</p>
                <h3 className="text-white font-bold text-lg">{channel.name}</h3>
                <p className="text-white/50 text-sm mt-1">15-minute free preview ended</p>
              </div>
              <button
                onClick={() => setShowPremium(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-3 rounded-2xl"
              >
                <Crown className="w-4 h-4" />
                Unlock — from KES 100/mo
              </button>
            </div>
          </div>
        )}

        {/* Watch-time progress bar (visible when not locked, last 5 min) */}
        {!locked && (
          <>
            {/* Thin progress bar at bottom of video */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-10 pointer-events-none">
              <div
                className="h-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-1000"
                style={{ width: `${watchedPercent}%` }}
              />
            </div>

            {/* Countdown badge when < 5 min left */}
            {remainingSecs <= 300 && remainingSecs > 0 && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="flex items-center gap-1.5 bg-amber-500/20 backdrop-blur border border-amber-500/40 rounded-full px-3 py-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-300 text-xs font-bold">
                    Free preview: {Math.floor(remainingSecs / 60)}:{String(remainingSecs % 60).padStart(2, '0')} left
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Channel info + actions ── */}
      <div className="px-4 py-4 border-b border-white/8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {channel.logo && (
                <img src={channel.logo} alt={channel.name}
                  className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5"
                  onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              )}
              <h2 className="text-white font-bold text-lg leading-tight truncate">{channel.name}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">{flag}</span>
              <span className="text-white/60 text-sm">{channel.country || 'Global'}</span>
              {channel.languages?.[0] && <span className="text-white/40 text-xs uppercase">· {channel.languages[0]}</span>}
              {channel.network && (
                <span className="flex items-center gap-1 text-white/30 text-xs"><Globe className="w-3 h-3" />{channel.network}</span>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {channel.categories?.map(c => (
                <span key={c} className={cn('text-white text-[11px] font-semibold px-2 py-0.5 rounded-full', categoryColor(c))}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <ActionBtn active={liked} activeClass="bg-primary/30 border-primary/50" onClick={handleLike} label={formatCount(likeCount)}>
              <Heart className={cn('w-5 h-5', liked ? 'text-primary fill-primary' : 'text-white')} />
            </ActionBtn>
            <ActionBtn active={faved} activeClass="bg-yellow-500/30 border-yellow-500/50" onClick={handleFav} label="Save">
              <Bookmark className={cn('w-5 h-5', faved ? 'text-yellow-400 fill-yellow-400' : 'text-white')} />
            </ActionBtn>
            <ActionBtn onClick={handleShare} label="Share">
              <Share2 className="w-5 h-5 text-white" />
            </ActionBtn>
          </div>
        </div>

        {/* Watch-time mini bar */}
        {!locked && watchedPercent > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/30 text-[10px]">Free watch time used</span>
              <span className="text-white/40 text-[10px]">{Math.round(watchedPercent)}%</span>
            </div>
            <div className="h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000',
                  watchedPercent > 80 ? 'bg-red-400' : watchedPercent > 50 ? 'bg-amber-400' : 'bg-primary')}
                style={{ width: `${watchedPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Comments ── */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-5 h-5 text-white/60" />
          <h3 className="text-white font-semibold">{formatCount(count)} Comments</h3>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex-shrink-0 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{(user?.username || '?').charAt(0).toUpperCase()}</span>
          </div>
          <input
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendComment()}
            placeholder={user ? 'Add a comment…' : 'Login to comment…'}
            className="flex-1 bg-white/10 text-white placeholder-white/30 text-sm rounded-full px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={handleSendComment}
            disabled={!commentText.trim() || sending}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40"
          >
            {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <span className="text-white text-sm">↑</span>}
          </button>
        </div>

        <div className="space-y-4 pb-10">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex-shrink-0 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {(c.user_profiles?.username || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-xs font-semibold">@{c.user_profiles?.username || 'user'}</span>
                  <span className="text-white/30 text-[11px]">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-white/80 text-sm mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-white/20 text-sm text-center py-6">No comments yet — be first!</p>
          )}
        </div>
      </div>

      {showAuth    && <AuthModal onClose={() => setShowAuth(false)} />}
      {showPremium && <PremiumModal channelName={channel.name} onClose={() => setShowPremium(false)} />}
    </div>
  );
}

function ActionBtn({
  children, label, active, activeClass, onClick
}: {
  children: React.ReactNode;
  label?: string;
  active?: boolean;
  activeClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5',
        'w-12 h-14 rounded-xl border border-white/10',
        'bg-white/5 hover:bg-white/10 active:scale-95 transition-all',
        active && activeClass
      )}
    >
      {children}
      {label && <span className="text-white/60 text-[10px] font-medium">{label}</span>}
    </button>
  );
}
