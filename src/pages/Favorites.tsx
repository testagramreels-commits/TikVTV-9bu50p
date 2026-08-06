import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Loader2, Tv, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useFavorites } from '@/hooks/useFavorites';
import { useComments } from '@/hooks/useComments';
import VideoPlayer from '@/components/features/VideoPlayer';
import ChannelInfo from '@/components/features/ChannelInfo';
import ReactionBar from '@/components/features/ReactionBar';
import CommentSheet from '@/components/features/CommentSheet';
import AuthModal from '@/components/features/AuthModal';
import { useT } from '@/lib/i18n';
import type { IPTVChannel, AuthUser } from '@/types';

const PRELOAD_RADIUS = 2;

export default function Favorites() {
  const { user }                      = useAuthStore();
  const navigate                      = useNavigate();
  const t                             = useT();
  const { favorites, loading }        = useFavorites(user?.id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAuth,    setShowAuth]    = useState(false);
  const [deadIds,     setDeadIds]     = useState<Set<string>>(new Set());
  const containerRef                  = useRef<HTMLDivElement>(null);
  const observerRef                   = useRef<IntersectionObserver | null>(null);

  const channels: IPTVChannel[] = favorites
    .map(f => f.channel_data)
    .filter(ch => !deadIds.has(ch.id));

  useEffect(() => {
    const container = containerRef.current;
    if (!container || channels.length === 0) return;
    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          setActiveIndex(parseInt(e.target.getAttribute('data-index') || '0', 10));
        }
      }),
      { threshold: 0.55, root: container }
    );
    container.querySelectorAll('[data-index]').forEach(c => observer.observe(c));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [channels.length]);

  const handleDead = useCallback((id: string) =>
    setDeadIds(prev => new Set([...prev, id])), []);

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="relative z-20 flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur border-b border-white/5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-bold">{t('favorites')}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Bookmark className="w-10 h-10 text-white/20" />
          </div>
          <p className="text-white/60 text-center">{t('loginRequired')}</p>
          <button
            onClick={() => setShowAuth(true)}
            className="bg-primary text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            {t('login')}
          </button>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur border-b border-white/5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-bold">{t('favorites')}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur border-b border-white/5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-bold">{t('favorites')}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
            <Bookmark className="w-12 h-12 text-white/10" />
          </div>
          <div className="text-center">
            <p className="text-white/60 font-semibold mb-1">{t('noFavorites')}</p>
            <p className="text-white/30 text-sm">{t('noFavoritesHint')}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            {t('saveFavorites')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <div className="relative z-20 flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur border-b border-white/5">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Tv className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="text-white font-bold">{t('favorites')}</span>
            <p className="text-white/30 text-[10px]">{channels.length} {t('channels')}</p>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', overscrollBehavior: 'contain' }}
      >
        {channels.map((channel, index) => (
          <FavCard
            key={channel.id}
            channel={channel}
            isActive={index === activeIndex}
            shouldLoad={Math.abs(index - activeIndex) <= PRELOAD_RADIUS}
            index={index}
            user={user}
            onAuthRequired={() => setShowAuth(true)}
            onDead={handleDead}
          />
        ))}

        <div
          className="flex items-center justify-center bg-black"
          style={{ height: '50dvh', scrollSnapAlign: 'start' }}
        >
          <p className="text-white/20 text-sm">
            {channels.length} saved {channels.length === 1 ? 'channel' : 'channels'} 🔖
          </p>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

function FavCard({
  channel, isActive, shouldLoad, index,
  user, onAuthRequired, onDead,
}: {
  channel:        IPTVChannel;
  isActive:       boolean;
  shouldLoad:     boolean;
  index:          number;
  user:           AuthUser | null;
  onAuthRequired: () => void;
  onDead:         (id: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const { count, fetchCount }          = useComments(channel.id);

  useEffect(() => {
    if (isActive) fetchCount();
  }, [isActive, fetchCount]);

  return (
    <div
      data-index={index}
      className="relative w-full bg-black"
      style={{ height: '100dvh', scrollSnapAlign: 'start' }}
    >
      <VideoPlayer
        src={channel.streamUrl}
        isActive={isActive}
        shouldLoad={shouldLoad}
        channelName={channel.name}
        channelLogo={channel.logo}
        onError={() => onDead(channel.id)}
      />
      <div className="absolute inset-0 pointer-events-none gradient-overlay" />
      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none gradient-top" />

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 flex items-end justify-between gap-4">
        <div className="flex-1 min-w-0 pb-1">
          <ChannelInfo channel={channel} />
        </div>
        <div className="flex-shrink-0 pb-2">
          <ReactionBar
            channel={channel}
            user={user}
            commentCount={count}
            onCommentClick={() => setShowComments(true)}
            onAuthRequired={onAuthRequired}
          />
        </div>
      </div>

      {showComments && (
        <CommentSheet
          channelId={channel.id}
          channelName={channel.name}
          user={user}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}
