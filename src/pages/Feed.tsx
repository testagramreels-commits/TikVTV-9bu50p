
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Wifi, RefreshCw } from 'lucide-react';
import { useChannels } from '@/hooks/useChannels';
import { useAuthStore } from '@/stores/authStore';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useBackButtonExit } from '@/hooks/useBackButtonExit';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { useChannelAutoUpdate } from '@/hooks/useChannelAutoUpdate';
import { useIsAndroidTV, useTVKeyboardNav } from '@/hooks/useAndroidTV';
import ChannelCard from '@/components/features/ChannelCard';
import CategoryTabs from '@/components/features/CategoryTabs';
import Header from '@/components/layout/Header';
import LoadingCard from '@/components/features/LoadingCard';
import AuthModal from '@/components/features/AuthModal';
import HighlightsReel from '@/components/features/HighlightsReel';
import { useT } from '@/lib/i18n';

const PRELOAD_RADIUS   = 2;   // preload ±2 cards
const HIGHLIGHTS_EVERY = 8;

export default function Feed() {
  const [searchParams]                = useSearchParams();
  const navigate                      = useNavigate();
  const countryFilter                 = searchParams.get('country') || '';
  const catParam                      = searchParams.get('cat') || '';
  const [category,    setCategory]    = useState(catParam || 'all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAuth,    setShowAuth]    = useState(false);
  const [deadIds,     setDeadIds]     = useState<Set<string>>(new Set());
  const [liveIds,     setLiveIds]     = useState<Set<string>>(new Set());
  const t = useT();

  useBackButtonExit();
  const isTV = useIsAndroidTV();

  const { channels, loading, hasMore, loadMore, total, error, refresh } = useChannels(category, countryFilter);
  const { user }                   = useAuthStore();
  const { addToHistory }           = useWatchHistory();
  const { topCategories, hasData } = useAiSuggestions();
  const containerRef               = useRef<HTMLDivElement>(null);
  const observerRef                = useRef<IntersectionObserver | null>(null);

  const { updateAvailable, setUpdateAvailable } = useChannelAutoUpdate(refresh);

  useEffect(() => {
    if (catParam && catParam !== category) setCategory(catParam);
  }, [catParam, category]);

  const liveChannels = channels.filter(ch => !deadIds.has(ch.id));
  const liveCount    = liveIds.size;

  const scrollToIndex = useCallback((idx: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cards = container.querySelectorAll('[data-index]');
    const target = cards[idx] as HTMLElement;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useTVKeyboardNav({
    enabled: isTV,
    onDown:   () => scrollToIndex(Math.min(activeIndex + 1, liveChannels.length - 1)),
    onUp:     () => scrollToIndex(Math.max(activeIndex - 1, 0)),
    onSelect: () => {},
    onBack:   () => { if (category !== 'all') setCategory('all'); },
  });

  // Intersection observer for active card detection + load-more trigger
  useEffect(() => {
    const container = containerRef.current;
    if (!container || liveChannels.length === 0) return;
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.getAttribute('data-index') || '0', 10);
            setActiveIndex(idx);
            if (liveChannels[idx]) addToHistory(liveChannels[idx]);
            // Load more when within 5 cards of the end
            if (idx >= liveChannels.length - 5 && hasMore) loadMore();
          }
        });
      },
      { threshold: 0.55, root: container }
    );

    container.querySelectorAll('[data-index]').forEach(c => observer.observe(c));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [liveChannels.length, hasMore, loadMore, addToHistory]);

  const handleCategoryChange = useCallback((id: string) => {
    setCategory(id);
    setActiveIndex(0);
    setDeadIds(new Set());
    setLiveIds(new Set());
    containerRef.current?.scrollTo({ top: 0 });
  }, []);

  const handleChannelDead = useCallback((id: string) => {
    setDeadIds(prev => new Set([...prev, id]));
    setLiveIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const handleChannelReady = useCallback((id: string) => {
    setLiveIds(prev => new Set([...prev, id]));
  }, []);

  const handleDismissUpdate = () => {
    setUpdateAvailable(false);
    refresh();
  };

  if (loading && liveChannels.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col overflow-hidden" style={{ backgroundColor: '#000' }}>
        <Header liveCount={0} totalChannels={0} />
        <CategoryTabs activeCategory={category} onCategoryChange={handleCategoryChange} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {/* Splash logo */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center border border-white/10">
            <span className="text-4xl">📺</span>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-xl">Tik<span className="text-primary">V</span>TV</p>
            <p className="text-white/30 text-sm mt-1">Loading live channels...</p>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && liveChannels.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col">
        <Header liveCount={0} totalChannels={0} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Wifi className="w-12 h-12 text-white/20" />
          <p className="text-white/50 text-sm text-center px-8">{t('failedLoad')}</p>
          <button onClick={() => window.location.reload()}
            className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold">
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isTV ? 'tv-layout' : ''}`} style={{ backgroundColor: '#000' }}>
      <Header liveCount={liveCount} totalChannels={total} />

      {countryFilter ? (
        <div className="bg-black/60 backdrop-blur px-4 py-2 border-b border-white/5 flex items-center gap-2">
          <span className="text-white/50 text-xs">{t('filteringByCountry')}</span>
          <span className="text-white text-xs font-semibold bg-white/10 px-2 py-0.5 rounded-full">
            {countryFilter.toUpperCase()}
          </span>
          <button onClick={() => navigate('/')} className="ml-auto text-primary text-xs hover:underline">
            {t('clearFilter')}
          </button>
        </div>
      ) : (
        <CategoryTabs
          activeCategory={category}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {/* Channel auto-update banner */}
      {updateAvailable && (
        <div className="flex-none px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs text-white/70 flex-1">New channels available!</span>
          <button onClick={handleDismissUpdate}
            className="text-xs font-semibold text-primary hover:underline flex-shrink-0">
            Refresh
          </button>
        </div>
      )}

      {/* AI suggestion strip */}
      {hasData && !countryFilter && category === 'all' && (
        <div className="flex-none px-3 py-2 border-b border-white/5 bg-black/80">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[10px] text-white/40 font-semibold flex-shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-secondary inline-block" />
              For you:
            </span>
            {topCategories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className="flex-shrink-0 text-[10px] font-semibold text-white/70 bg-white/8 hover:bg-primary/20 hover:text-primary border border-white/10 px-2.5 py-1 rounded-full transition-colors capitalize"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed scroll container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', overscrollBehavior: 'contain' }}
      >
        {liveChannels.map((channel, index) => (
          <div key={`${channel.id}-${index}`}>
            <ChannelCard
              channel={channel}
              isActive={index === activeIndex}
              shouldLoad={Math.abs(index - activeIndex) <= PRELOAD_RADIUS}
              index={index}
              user={user}
              onAuthRequired={() => setShowAuth(true)}
              onChannelDead={handleChannelDead}
              onChannelReady={handleChannelReady}
            />
            {/* Highlights reel every N channels */}
            {(index + 1) % HIGHLIGHTS_EVERY === 0 && index < liveChannels.length - 1 && (
              <div style={{ scrollSnapAlign: 'none' }}>
                <HighlightsReel />
              </div>
            )}
          </div>
        ))}

        {/* Load more indicator */}
        {hasMore ? (
          <div className="flex items-center justify-center bg-black"
            style={{ height: '100dvh', scrollSnapAlign: 'start' }}>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
              <p className="text-white/30 text-xs">{t('loadingMore')}</p>
            </div>
          </div>
        ) : liveChannels.length > 0 ? (
          <div className="flex items-center justify-center bg-black"
            style={{ height: '50dvh', scrollSnapAlign: 'start' }}>
            <p className="text-white/20 text-sm">
              {t('seenAll')} {total.toLocaleString()} {t('channelsLabel')} 🎉
            </p>
          </div>
        ) : null}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
