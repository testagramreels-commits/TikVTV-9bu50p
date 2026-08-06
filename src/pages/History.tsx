import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2, ArrowLeft, Play, X } from 'lucide-react';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { getCountryFlag, categoryColor, timeAgo, cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { WatchHistoryItem } from '@/types';

export default function History() {
  const navigate = useNavigate();
  const t        = useT();
  const { history, removeFromHistory, clearHistory, getSuggestedCategories } = useWatchHistory();
  const suggested = getSuggestedCategories(5);

  return (
    <div className="min-h-screen bg-black flex flex-col pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/8">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg leading-none flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Watch History
            </h1>
            <p className="text-white/30 text-xs mt-0.5">{history.length} channels watched</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-1.5 text-white/40 hover:text-red-400 text-xs transition-colors px-3 py-1.5 rounded-full hover:bg-red-400/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* AI Suggestions based on history */}
        {suggested.length > 0 && (
          <div className="px-4 py-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-secondary" />
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">AI — Based on your history</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {suggested.map(cat => (
                <button
                  key={cat}
                  onClick={() => navigate(`/?cat=${cat}`)}
                  className="text-xs font-semibold text-white bg-white/8 hover:bg-primary/20 hover:text-primary border border-white/10 px-3 py-1.5 rounded-full transition-colors capitalize"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <Clock className="w-10 h-10 text-white/10" />
            </div>
            <div className="text-center">
              <p className="text-white/50 font-semibold">No watch history yet</p>
              <p className="text-white/30 text-sm mt-1">Channels you watch will appear here</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Browse Channels
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2 pb-6">
            {history.map(item => (
              <HistoryCard
                key={`${item.channelId}-${item.watchedAt}`}
                item={item}
                onPlay={() => navigate(`/channel/${item.channelId}`)}
                onRemove={() => removeFromHistory(item.channelId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryCard({
  item, onPlay, onRemove,
}: {
  item:     WatchHistoryItem;
  onPlay:   () => void;
  onRemove: () => void;
}) {
  const flag = getCountryFlag(item.countryCode);

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-colors group">
      {/* Logo */}
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
        {item.logo ? (
          <img
            src={item.logo}
            alt={item.name}
            className="w-full h-full object-contain p-1"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-white/60 font-bold text-lg">{item.name.charAt(0)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{item.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-sm leading-none">{flag}</span>
          <span className="text-white/40 text-xs">{item.country || 'Global'}</span>
          {item.categories[0] && (
            <span className={cn('text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full', categoryColor(item.categories[0]))}>
              {item.categories[0]}
            </span>
          )}
          <span className="text-white/25 text-[10px] ml-auto">{timeAgo(item.watchedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onRemove}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/60" />
        </button>
        <button
          onClick={onPlay}
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <Play className="w-3.5 h-3.5 text-white fill-white" />
        </button>
      </div>
    </div>
  );
}
