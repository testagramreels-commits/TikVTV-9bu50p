/**
 * LiveChannelSearch — instant channel search overlay.
 * Shows logo, country flag, category. Filters feed as user types.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Tv2, Loader2, Play } from 'lucide-react';
import { searchChannels } from '@/lib/iptvApi';
import { getCountryFlag, cn } from '@/lib/utils';
import type { IPTVChannel } from '@/types';

interface Props {
  onClose: () => void;
}

export default function LiveChannelSearch({ onClose }: Props) {
  const navigate        = useNavigate();
  const [query,  setQuery]    = useState('');
  const [results, setResults] = useState<IPTVChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const doSearch = useCallback((q: string) => {
    clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      const r = searchChannels(q, 'all', '', 40);
      setResults(r);
      setLoading(false);
    }, 120);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    doSearch(e.target.value);
  };

  const handleSelect = (ch: IPTVChannel) => {
    onClose();
    navigate(`/?cat=${ch.categories[0] || 'all'}`);
  };

  // Group by category for display
  const grouped = results.reduce<Record<string, IPTVChannel[]>>((acc, ch) => {
    const cat = ch.categories[0] || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ch);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[90] flex flex-col" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />

      {/* Search panel */}
      <div className="relative z-10 flex flex-col h-full max-w-lg mx-auto w-full" onClick={e => e.stopPropagation()}>
        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 pt-14 pb-3">
          <div className="flex-1 flex items-center gap-3 bg-white/10 border border-white/20 rounded-2xl px-4 py-3">
            <Search className="w-4 h-4 text-white/50 flex-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              placeholder="Search channels, countries, categories…"
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 outline-none"
              onKeyDown={e => e.key === 'Escape' && onClose()}
            />
            {loading && <Loader2 className="w-4 h-4 text-white/30 animate-spin flex-none" />}
            {query && !loading && (
              <button onClick={() => { setQuery(''); setResults([]); }} className="flex-none">
                <X className="w-4 h-4 text-white/40" />
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-white/60 text-sm font-semibold whitespace-nowrap hover:text-white transition-colors">
            Cancel
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {!query ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Search className="w-10 h-10 text-white/10" />
              <p className="text-white/30 text-sm text-center">Search across 100k+ channels worldwide</p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {['news', 'sports', 'music', 'kids', 'KE', 'US', 'IN', 'GB'].map(tag => (
                  <button key={tag} onClick={() => { setQuery(tag); doSearch(tag); }}
                    className="text-white/40 border border-white/15 text-xs px-3 py-1.5 rounded-full hover:border-white/30 hover:text-white/70 transition-colors capitalize">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Tv2 className="w-8 h-8 text-white/10" />
              <p className="text-white/40 text-sm">No channels found for "{query}"</p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, chs]) => (
              <div key={cat} className="mb-4">
                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-2 capitalize">{cat}</p>
                <div className="space-y-1">
                  {chs.slice(0, 8).map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => handleSelect(ch)}
                      className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-3 py-2.5 transition-all active:scale-[0.98] text-left"
                    >
                      {ch.logo
                        ? <img src={ch.logo} alt={ch.name} className="w-10 h-10 rounded-xl object-contain bg-white/5 p-1 flex-none" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-none"><Tv2 className="w-4 h-4 text-primary/50" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{ch.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-sm">{getCountryFlag(ch.countryCode)}</span>
                          <span className="text-white/30 text-xs">{ch.countryCode}</span>
                          <span className="text-white/20 text-xs">·</span>
                          <span className="text-primary/50 text-xs capitalize">{ch.categories[0]}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-none">
                        <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
