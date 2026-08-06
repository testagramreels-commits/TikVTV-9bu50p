import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Loader2, SearchIcon } from 'lucide-react';
import { fetchAllChannels, getCountries } from '@/lib/iptvApi';
import { getCountryFlag, getCountryName } from '@/lib/utils';
import type { CountryInfo } from '@/types';

export default function CountryExplorer() {
  const navigate             = useNavigate();
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetchAllChannels().then(() => {
      const raw = getCountries();
      const infos: CountryInfo[] = raw.map(({ code, count }) => ({
        code,
        count,
        flag: getCountryFlag(code),
        name: getCountryName(code),
      }));
      setCountries(infos);
      setLoading(false);
    });
  }, []);

  const filtered = query
    ? countries.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code.toLowerCase().includes(query.toLowerCase())
      )
    : countries;

  const handleSelect = (code: string) => navigate(`/?country=${code}`);

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
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Country Explorer</h1>
            {!loading && (
              <p className="text-white/30 text-xs mt-0.5">{countries.length} countries · Live TV worldwide</p>
            )}
          </div>
          <div className="ml-auto w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Globe className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2.5">
            <SearchIcon className="w-4 h-4 text-white/40" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter countries…"
              className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
            <p className="text-white/30 text-sm">Loading countries…</p>
          </div>
        ) : (
          <>
            {/* Top countries highlight */}
            {!query && (
              <>
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
                  🔥 Most Channels
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {filtered.slice(0, 6).map(c => (
                    <TopCountryCard key={c.code} country={c} onClick={() => handleSelect(c.code)} />
                  ))}
                </div>
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
                  🌍 All Countries
                </p>
              </>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {(query ? filtered : filtered.slice(6)).map(c => (
                <CountryCard key={c.code} country={c} onClick={() => handleSelect(c.code)} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Globe className="w-12 h-12 text-white/10" />
                <p className="text-white/30 text-sm">No countries found</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TopCountryCard({ country, onClick }: { country: CountryInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl transition-all hover:scale-105 active:scale-95"
    >
      <span className="text-4xl leading-none">{country.flag}</span>
      <div className="text-center">
        <p className="text-white font-semibold text-sm truncate w-full">{country.name}</p>
        <p className="text-primary text-xs font-bold mt-0.5">{country.count.toLocaleString()} channels</p>
      </div>
    </button>
  );
}

function CountryCard({ country, onClick }: { country: CountryInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/5 rounded-xl transition-all hover:scale-105 active:scale-95"
    >
      <span className="text-2xl leading-none">{country.flag}</span>
      <p className="text-white/70 text-xs text-center leading-tight line-clamp-1 w-full">{country.name}</p>
      <p className="text-white/30 text-[10px] font-mono">{country.count}</p>
    </button>
  );
}
