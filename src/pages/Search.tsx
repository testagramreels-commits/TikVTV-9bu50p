import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, SearchIcon, X, Tv, Loader2 } from 'lucide-react';
import { fetchAllChannels, searchChannels } from '@/lib/iptvApi';
import { getCountryFlag, categoryColor, cn } from '@/lib/utils';
import { CATEGORIES } from '@/constants/categories';
import type { IPTVChannel } from '@/types';

export default function Search() {
  const navigate              = useNavigate();
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<IPTVChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready,   setReady]   = useState(false);
  const [cat,     setCat]     = useState('all');
  const debounceRef           = useRef<ReturnType<typeof setTimeout>>();
  const inputRef              = useRef<HTMLInputElement>(null);

  // Pre-load channel data
  useEffect(() => {
    fetchAllChannels().then(() => {
      setReady(true);
      setResults(searchChannels('', 'all', '', 60));
    });
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const runSearch = useCallback((q: string, category: string) => {
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      setResults(searchChannels(q, category, '', 80));
      setLoading(false);
    }, 250);
  }, []);

  const handleQuery = (v: string) => { setQuery(v); runSearch(v, cat); };
  const handleCat   = (c: string) => { setCat(c);   runSearch(query, c); };

  const goToChannel = (ch: IPTVChannel) => navigate(`/channel/${ch.id}`);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Search input */}
          <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-full px-4 py-2.5">
            <SearchIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder="Search channels, countries, categories…"
              className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
            />
            {query && (
              <button onClick={() => handleQuery('')}>
                <X className="w-4 h-4 text-white/40 hover:text-white/80 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {CATEGORIES.slice(0, 8).map(c => (
            <button
              key={c.id}
              onClick={() => handleCat(c.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                cat === c.id
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              )}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!ready ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
            <p className="text-white/30 text-sm">Loading channels…</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Tv className="w-12 h-12 text-white/10" />
            <p className="text-white/30 text-sm">No channels found</p>
            {query && (
              <p className="text-white/20 text-xs text-center px-8">
                Try a different search term or category
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-white/30 text-xs px-4 pt-4 pb-2">
              {results.length} channel{results.length !== 1 ? 's' : ''} found
              {query ? ` for "${query}"` : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
              {results.map(ch => (
                <ChannelRow key={ch.id} channel={ch} onClick={() => goToChannel(ch)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChannelRow({ channel: ch, onClick }: { channel: IPTVChannel; onClick: () => void }) {
  const flag = getCountryFlag(ch.countryCode);
  const cat  = ch.categories[0] || 'general';
  const [imgErr, setImgErr] = useState(false);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors text-left w-full"
    >
      {/* Logo */}
      <div className="w-12 h-12 rounded-xl bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {ch.logo && !imgErr ? (
          <img
            src={ch.logo}
            alt={ch.name}
            className="w-full h-full object-contain p-1"
            onError={() => setImgErr(true)}
          />
        ) : (
          <span className="text-white/50 text-lg font-bold">{ch.name.charAt(0)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{ch.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-base leading-none">{flag}</span>
          <span className="text-white/40 text-xs">{ch.country || 'Global'}</span>
          {ch.languages[0] && (
            <span className="text-white/25 text-xs uppercase">· {ch.languages[0]}</span>
          )}
        </div>
      </div>

      {/* Category badge */}
      <span className={cn('text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', categoryColor(cat))}>
        {cat.charAt(0).toUpperCase() + cat.slice(1)}
      </span>
    </button>
  );
}
