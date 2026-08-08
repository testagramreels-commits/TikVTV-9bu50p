/**
 * Enhanced Channel Discovery — featured channels, trending, curated collections,
 * mood-based picks, top countries, smart search.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Loader2, Search, Flame, Star, TrendingUp,
  Sparkles, Tv2, Radio, Play, ChevronRight, Filter,
} from 'lucide-react';
import { fetchAllChannels, getCountries, searchChannels } from '@/lib/iptvApi';
import { getCountryFlag, getCountryName, cn } from '@/lib/utils';
import type { IPTVChannel, CountryInfo } from '@/types';

const MOODS = [
  { id: 'news',          emoji: '📰', label: 'Breaking News'  },
  { id: 'sports',        emoji: '⚽', label: 'Sports'         },
  { id: 'entertainment', emoji: '🎬', label: 'Entertainment'  },
  { id: 'music',         emoji: '🎵', label: 'Music'          },
  { id: 'kids',          emoji: '🧸', label: 'Kids'           },
  { id: 'documentary',   emoji: '🌍', label: 'Docs'           },
  { id: 'religious',     emoji: '🙏', label: 'Religious'      },
  { id: 'cooking',       emoji: '👨‍🍳', label: 'Cooking'         },
];

const FEATURED_COUNTRIES = ['US','GB','KE','NG','IN','ZA','EG','FR','DE','JP','BR','AU'];

function ChannelPill({ ch, onClick }: { ch: IPTVChannel; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 bg-white/5 hover:bg-white/12 border border-white/8 rounded-2xl px-3 py-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] flex-none">
      {ch.logo
        ? <img src={ch.logo} alt={ch.name} className="w-8 h-8 rounded-lg object-contain bg-white/5 flex-none" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-none"><Tv2 className="w-3.5 h-3.5 text-primary/60" /></div>}
      <div className="text-left min-w-0">
        <p className="text-white text-xs font-semibold truncate max-w-[100px]">{ch.name}</p>
        <p className="text-white/30 text-[9px]">{ch.countryCode}</p>
      </div>
    </button>
  );
}

function ChannelCard({ ch, onClick, featured = false }: { ch: IPTVChannel; onClick: () => void; featured?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn(
        'relative flex flex-col items-start gap-2 rounded-2xl overflow-hidden border border-white/8 transition-all hover:scale-[1.02] active:scale-[0.98] text-left',
        featured ? 'p-4 bg-gradient-to-br from-primary/15 to-secondary/10' : 'p-3 bg-white/5 hover:bg-white/10'
      )}>
      {featured && <div className="absolute top-2 right-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full">FEATURED</div>}
      {ch.logo
        ? <img src={ch.logo} alt={ch.name} className={cn('rounded-xl object-contain bg-white/8', featured ? 'w-14 h-14' : 'w-10 h-10')} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <div className={cn('rounded-xl bg-primary/20 flex items-center justify-center', featured ? 'w-14 h-14' : 'w-10 h-10')}><Tv2 className={cn('text-primary/60', featured ? 'w-6 h-6' : 'w-4 h-4')} /></div>}
      <div className="min-w-0 w-full">
        <p className={cn('text-white font-semibold truncate', featured ? 'text-sm' : 'text-xs')}>{ch.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-white/30 text-[9px]">{ch.countryCode}</span>
          {ch.categories[0] && <span className="text-primary/60 text-[9px] capitalize">· {ch.categories[0]}</span>}
        </div>
      </div>
      <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
        <Play className="w-2.5 h-2.5 text-primary ml-0.5" />
      </div>
    </button>
  );
}

export default function CountryExplorer() {
  const navigate          = useNavigate();
  const [allCh,  setAllCh]      = useState<IPTVChannel[]>([]);
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [query,     setQuery]    = useState('');
  const [results,   setResults]  = useState<IPTVChannel[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeMood, setMood]    = useState('');
  const [moodCh,   setMoodCh]   = useState<IPTVChannel[]>([]);
  const [view,     setView]      = useState<'home' | 'country' | 'search'>('home');
  const [selectedCountry, setSelCountry] = useState('');

  useEffect(() => {
    fetchAllChannels().then(all => {
      setAllCh(all);
      const raw = getCountries();
      setCountries(raw.map(({ code, count }) => ({
        code, count, flag: getCountryFlag(code), name: getCountryName(code),
      })));
      setLoading(false);
    });
  }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (!q.trim()) { setView('home'); setResults([]); return; }
    setView('search');
    setSearching(true);
    setTimeout(() => {
      setResults(searchChannels(q, 'all', '', 60));
      setSearching(false);
    }, 100);
  }, []);

  const handleMood = (id: string) => {
    if (activeMood === id) { setMood(''); setMoodCh([]); return; }
    setMood(id);
    setMoodCh(searchChannels('', id, '', 20));
  };

  const navigate2Ch = (ch: IPTVChannel) => navigate(`/?cat=${ch.categories[0] || 'all'}`);

  const featured = allCh.filter(ch => ['news','sports','entertainment'].some(c => ch.categories.includes(c))).slice(0, 6);
  const trending = allCh.filter(ch => ch.categories.includes('news') || ch.categories.includes('sports')).slice(10, 26);
  const featCountries = FEATURED_COUNTRIES.map(cc => countries.find(c => c.code === cc)).filter(Boolean) as CountryInfo[];

  return (
    <div className="min-h-screen bg-black flex flex-col pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-white/8 px-4 pt-12 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg leading-none">Discover</h1>
            {!loading && <p className="text-white/30 text-xs mt-0.5">{allCh.length.toLocaleString()} channels worldwide</p>}
          </div>
          <button onClick={() => setView(v => v === 'country' ? 'home' : 'country')}
            className={cn('w-9 h-9 rounded-full flex items-center justify-center transition-colors',
              view === 'country' ? 'bg-primary/20 border border-primary/40' : 'bg-white/10')}>
            <Globe className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-2xl px-4 py-2.5">
          <Search className="w-4 h-4 text-white/40" />
          <input value={query} onChange={e => handleSearch(e.target.value)}
            placeholder="Search channels, countries, categories…"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none" />
          {query && <button onClick={() => handleSearch('')} className="text-white/30 hover:text-white text-sm">×</button>}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 text-white/30 animate-spin" />
          <p className="text-white/30 text-sm">Loading worldwide channels…</p>
        </div>
      ) : view === 'search' ? (
        /* ── Search results ── */
        <div className="px-4 py-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            {searching ? 'Searching…' : `${results.length} results for "${query}"`}
          </p>
          {searching
            ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
            : <div className="grid grid-cols-2 gap-2.5">
                {results.map(ch => <ChannelCard key={ch.id} ch={ch} onClick={() => navigate2Ch(ch)} />)}
              </div>}
        </div>
      ) : view === 'country' ? (
        /* ── Country browser ── */
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {countries.map(c => (
              <button key={c.code} onClick={() => navigate(`/?country=${c.code}`)}
                className="flex flex-col items-center gap-1.5 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all hover:scale-[1.04] active:scale-95">
                <span className="text-2xl">{c.flag}</span>
                <p className="text-white/70 text-[10px] text-center truncate w-full">{c.name}</p>
                <p className="text-primary/60 text-[9px] font-mono">{c.count.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Home discovery ── */
        <div className="overflow-y-auto">
          {/* Mood picker */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-white font-bold text-sm">What are you in the mood for?</p>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {MOODS.map(m => (
                <button key={m.id} onClick={() => handleMood(m.id)}
                  className={cn('flex-none flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all',
                    activeMood === m.id ? 'bg-primary text-white' : 'bg-white/8 text-white/70 hover:bg-white/15')}>
                  <span>{m.emoji}</span>{m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mood channels */}
          {activeMood && moodCh.length > 0 && (
            <Section title={`${MOODS.find(m => m.id === activeMood)?.emoji} ${MOODS.find(m => m.id === activeMood)?.label} Channels`}>
              <div className="flex gap-2.5 overflow-x-auto scrollbar-none px-4">
                {moodCh.map(ch => <ChannelPill key={ch.id} ch={ch} onClick={() => navigate2Ch(ch)} />)}
              </div>
            </Section>
          )}

          {/* Featured channels */}
          <Section title="⭐ Featured" action={{ label: 'See all', onClick: () => navigate('/') }}>
            <div className="grid grid-cols-2 gap-2.5 px-4">
              {featured.slice(0, 2).map(ch => <ChannelCard key={ch.id} ch={ch} featured onClick={() => navigate2Ch(ch)} />)}
              {featured.slice(2, 6).map(ch => <ChannelCard key={ch.id} ch={ch} onClick={() => navigate2Ch(ch)} />)}
            </div>
          </Section>

          {/* Trending */}
          <Section title="🔥 Trending Now">
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none px-4">
              {trending.map(ch => <ChannelPill key={ch.id} ch={ch} onClick={() => navigate2Ch(ch)} />)}
            </div>
          </Section>

          {/* Featured countries */}
          <Section title="🌍 Popular Countries" action={{ label: 'All countries', onClick: () => setView('country') }}>
            <div className="grid grid-cols-4 gap-2 px-4">
              {featCountries.map(c => (
                <button key={c.code} onClick={() => navigate(`/?country=${c.code}`)}
                  className="flex flex-col items-center gap-1 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all hover:scale-[1.04] active:scale-95">
                  <span className="text-2xl">{c.flag}</span>
                  <p className="text-white/60 text-[10px] font-medium">{c.name}</p>
                  <p className="text-primary/50 text-[9px]">{c.count.toLocaleString()}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* Live Radio */}
          <Section title="📻 Live Radio">
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none px-4">
              {allCh.filter(ch => ch.categories.includes('music') || ch.name.toLowerCase().includes('radio')).slice(0, 16).map(ch => (
                <ChannelPill key={ch.id} ch={ch} onClick={() => navigate2Ch(ch)} />
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-4 mb-3">
        <p className="text-white font-bold text-sm">{title}</p>
        {action && (
          <button onClick={action.onClick} className="flex items-center gap-1 text-primary text-xs font-semibold">
            {action.label} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
