import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Loader2, Heart, Flame, Repeat2 } from 'lucide-react';
import { useTrending } from '@/hooks/useTrending';
import { useT } from '@/lib/i18n';
import { getCountryFlag, categoryColor, cn, formatCount } from '@/lib/utils';
import type { IPTVChannel } from '@/types';
import { toast } from 'sonner';

export default function Trending() {
  const navigate     = useNavigate();
  const t            = useT();
  const { trending, loading } = useTrending(30);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-lg leading-none flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              {t('trendingChannels')}
            </h1>
            <p className="text-white/30 text-xs mt-0.5">{t('trendingSubtitle')}</p>
          </div>
          <div className="ml-auto w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
            <p className="text-white/30 text-sm">Loading trending…</p>
          </div>
        ) : trending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 px-8">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <Flame className="w-10 h-10 text-white/10" />
            </div>
            <div className="text-center">
              <p className="text-white/50 font-semibold">{t('noTrending')}</p>
              <p className="text-white/30 text-sm mt-1">{t('noTrendingHint')}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Browse Channels
            </button>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3 pb-28">
            {/* Legend */}
            <div className="flex items-center gap-4 px-1 pb-2">
              <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
                <Heart className="w-3 h-3 text-primary" /> Likes = 3pts
              </div>
              <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
                <Repeat2 className="w-3 h-3 text-green-400" /> Reposts = 5pts
              </div>
            </div>
            {trending.map((item, i) => item.channel && (
              <TrendingCard
                key={item.channel_id}
                rank={i + 1}
                channel={item.channel}
                score={item.score}
                onClick={() => navigate(`/channel/${item.channel_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrendingCard({
  rank, channel, score, onClick,
}: {
  rank: number;
  channel: IPTVChannel;
  score: number;
  onClick: () => void;
}) {
  const flag    = getCountryFlag(channel.countryCode);
  const isTop3  = rank <= 3;
  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `🔥 Trending: ${channel.name} on TikVTV!`;
    if (navigator.share) navigator.share({ title: channel.name, text }).catch(() => {});
    else { await navigator.clipboard.writeText(text); toast.success('Copied!'); }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] text-left',
        isTop3
          ? 'bg-white/8 border-white/15 hover:bg-white/12'
          : 'bg-white/4 border-white/8 hover:bg-white/8'
      )}
    >
      {/* Rank */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
        isTop3 ? rankColors[rank - 1] : 'text-white/30'
      )}>
        {isTop3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
      </div>

      {/* Logo */}
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
        {channel.logo ? (
          <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-1"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <span className="text-white/60 font-bold text-lg">{channel.name.charAt(0)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{channel.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-base leading-none">{flag}</span>
          <span className="text-white/40 text-xs truncate">{channel.country}</span>
          {channel.categories[0] && (
            <span className={cn('text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full', categoryColor(channel.categories[0]))}>
              {channel.categories[0]}
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="flex items-center gap-1 text-primary">
          <Flame className="w-3 h-3 text-orange-400" />
          <span className="text-xs font-bold text-white">{formatCount(score)}</span>
          <span className="text-white/30 text-[10px]">pts</span>
        </div>
        <button
          onClick={handleShare}
          className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          Share
        </button>
      </div>
    </button>
  );
}
