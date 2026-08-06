import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Globe, PictureInPicture2, Loader2, Wifi } from 'lucide-react';
import { fetchAllChannels, getChannelById } from '@/lib/iptvApi';
import { getCountryFlag, categoryColor, cn, formatCount, timeAgo } from '@/lib/utils';
import { useReactions } from '@/hooks/useReactions';
import { useFavorites } from '@/hooks/useFavorites';
import { useComments } from '@/hooks/useComments';
import { useAuthStore } from '@/stores/authStore';
import AuthModal from '@/components/features/AuthModal';
import type { IPTVChannel } from '@/types';
import { toast } from 'sonner';

export default function ChannelDetail() {
  const { id }             = useParams<{ id: string }>();
  const navigate           = useNavigate();
  const { user }           = useAuthStore();
  const [channel, setChannel] = useState<IPTVChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const videoRef           = useRef<HTMLVideoElement>(null);
  const hlsRef             = useRef<unknown>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [muted, setMuted]  = useState(false);
  const [pipActive, setPipActive] = useState(false);

  const { liked, likeCount, toggleLike }     = useReactions(id || '', user?.id);
  const { isFavorite, toggleFavorite }       = useFavorites(user?.id);
  const { comments, count, fetchComments, addComment } = useComments(id || '');

  useEffect(() => {
    if (!id) return;
    fetchAllChannels().then(() => {
      const ch = getChannelById(id);
      setChannel(ch || null);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (channel) {
      fetchComments();
      initVideo(channel.streamUrl);
    }
    return () => destroyHls();
  }, [channel]);

  const initVideo = async (src: string) => {
    const video = videoRef.current;
    if (!video || !src) return;
    setVideoReady(false);
    setVideoError(false);
    const { default: Hls } = await import('hls.js').catch(() => ({ default: null }));
    if (!Hls) return;
    if ((Hls as { isSupported: () => boolean }).isSupported()) {
      const hls = new (Hls as new (o: object) => {
        loadSource: (s: string) => void;
        attachMedia: (v: HTMLVideoElement) => void;
        on: (e: string, cb: unknown) => void;
        destroy: () => void;
      })({ enableWorker: false, maxBufferLength: 20, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on('hlsManifestParsed', () => { setVideoReady(true); video.play().catch(() => {}); });
      hls.on('hlsError', (_: unknown, d: { fatal: boolean }) => { if (d.fatal) setVideoError(true); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.onloadedmetadata = () => { setVideoReady(true); video.play().catch(() => {}); };
      video.onerror = () => setVideoError(true);
    }
  };

  const destroyHls = () => {
    if (hlsRef.current) {
      (hlsRef.current as { destroy: () => void }).destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; }
  };

  const handlePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {});
      setPipActive(false);
    } else {
      await video.requestPictureInPicture().catch(() => toast.error('PiP not supported'));
      setPipActive(true);
    }
  };

  const handleShare = async () => {
    const text = `Watching ${channel?.name} live on TikVTV!`;
    if (navigator.share) navigator.share({ title: channel?.name, text }).catch(() => {});
    else { await navigator.clipboard.writeText(text); toast.success('Copied!'); }
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
    <div className="min-h-screen bg-black">
      {/* Back button */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="pointer-events-auto w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-semibold text-sm truncate pointer-events-auto max-w-[60vw]">{channel.name}</h1>
      </div>

      {/* Video */}
      <div
        className="relative bg-black cursor-pointer"
        style={{ height: '56vw', maxHeight: 380, minHeight: 200 }}
        onClick={() => setMuted(m => !m)}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted={muted}
          playsInline
          loop
        />
        {!videoReady && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            {channel.logo ? (
              <img src={channel.logo} alt={channel.name} className="w-24 h-24 object-contain opacity-40" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white text-4xl font-bold">{channel.name.charAt(0)}</span>
              </div>
            )}
            <div className="absolute w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="flex flex-col items-center gap-2">
              <Wifi className="w-10 h-10 text-white/20" />
              <p className="text-white/40 text-sm">Stream unavailable</p>
            </div>
          </div>
        )}
        {videoReady && (
          <div className="absolute top-12 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            <div className="w-1.5 h-1.5 bg-white rounded-full live-dot" />
            LIVE
          </div>
        )}
        {/* PiP button */}
        {videoReady && 'pictureInPictureEnabled' in document && (
          <button
            onClick={e => { e.stopPropagation(); handlePiP(); }}
            className={cn(
              'absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors',
              pipActive ? 'bg-primary' : 'bg-black/50 backdrop-blur hover:bg-black/70'
            )}
          >
            <PictureInPicture2 className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* Channel info + actions */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {channel.logo && (
                <img src={channel.logo} alt={channel.name} className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5" />
              )}
              <h2 className="text-white font-bold text-xl leading-tight truncate">{channel.name}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">{flag}</span>
              <span className="text-white/60 text-sm">{channel.country || 'Global'}</span>
              {channel.languages[0] && <span className="text-white/40 text-xs uppercase">· {channel.languages[0]}</span>}
              {channel.network && (
                <span className="flex items-center gap-1 text-white/30 text-xs"><Globe className="w-3 h-3" />{channel.network}</span>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {channel.categories.map(c => (
                <span key={c} className={cn('text-white text-[11px] font-semibold px-2 py-0.5 rounded-full', categoryColor(c))}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </span>
              ))}
            </div>
          </div>

          {/* Action buttons */}
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
      </div>

      {/* Comments */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-5 h-5 text-white/60" />
          <h3 className="text-white font-semibold">{formatCount(count)} Comments</h3>
        </div>

        {/* Input */}
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
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all"
          >
            {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <span className="text-white text-sm">↑</span>}
          </button>
        </div>

        {/* Comments list */}
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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
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
        'flex flex-col items-center gap-0.5',
        'w-12 h-14 rounded-xl border border-white/10 flex items-center justify-center',
        'bg-white/5 hover:bg-white/10 active:scale-95 transition-all',
        active && activeClass
      )}
    >
      {children}
      {label && <span className="text-white/60 text-[10px] font-medium mt-0.5">{label}</span>}
    </button>
  );
}
