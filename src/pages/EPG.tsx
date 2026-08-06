
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, RefreshCw, Loader2, Tv2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAllChannels } from '@/lib/iptvApi';
import type { IPTVChannel } from '@/types';

interface EpgProgram {
  channel: string;
  title: string;
  description?: string;
  start: string;
  stop: string;
  isNow: boolean;
}

interface EpgGuide {
  channelId: string;
  programs: EpgProgram[];
}

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const SLOT_W  = 200;
const HDR_W   = 180;
const ROW_H   = 68;

function timeToOffset(dateStr: string, baseMs: number): number {
  const ms = new Date(dateStr).getTime() - baseMs;
  return Math.max(0, (ms / 1000 / 60 / 30) * SLOT_W);
}

function durationWidth(start: string, stop: string): number {
  const ms = new Date(stop).getTime() - new Date(start).getTime();
  return Math.max((ms / 1000 / 60 / 30) * SLOT_W, 80);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const PROGRAM_BANKS: Record<string, [string, number][]> = {
  news:          [['Morning Briefing',60],['World Headlines',30],['Market Update',30],['Breaking News',45],['Midday Report',30],['Political Hour',60],['Evening News',60],['Night Desk',30],['Late Headlines',30],['Overnight Report',90]],
  sports:        [['Soccer Highlights',60],['Sports Center',30],['Live Match',120],['Post-Match Analysis',45],['Basketball Today',60],['Tennis Open',90],['Formula 1',120],['Athletic Review',30],['Night Sports',60]],
  entertainment: [['Morning Show',60],['Talk Show',60],['Reality Check',60],['Drama Series',60],['Comedy Hour',30],['Game Show',45],['Evening Drama',60],['Late Night',60],['Midnight Feature',90]],
  music:         [['Top Hits',30],['Video Countdown',60],['Live Concert',90],['Retro Classics',60],['New Releases',30],['DJ Mix',60],['Acoustic Sessions',45],['Jazz Night',60],['Pop Charts',30]],
  documentary:   [['Nature Wonders',60],['History Vault',45],['Science Now',60],['True Crime',60],['Space Explorer',90],['Ocean Deep',60],['Wildlife',45],['Tech Frontiers',60]],
  kids:          [['Cartoon Hour',30],['Story Time',30],['Learning Fun',45],['Adventure Show',30],['Puzzle Time',30],['Art Corner',30],['Music & Dance',30],['Bedtime Stories',20]],
  general:       [['Morning Magazine',60],['Lifestyle',30],['Afternoon Film',120],['Evening Show',60],['Documentary',60],['Night Show',60],['Late Film',90]],
};

function generateMockEpg(channels: IPTVChannel[]): EpgGuide[] {
  const now = new Date();
  const base = new Date(now); base.setHours(0,0,0,0);
  const baseMs = base.getTime();
  const nowMs  = now.getTime();

  return channels.slice(0, 50).map(ch => {
    const cat = ch.categories[0] || 'general';
    const tpls = PROGRAM_BANKS[cat] || PROGRAM_BANKS.general;
    const programs: EpgProgram[] = [];
    let cursor = baseMs;

    while (cursor < baseMs + 24 * 60 * 60 * 1000) {
      const [title, durMins] = tpls[programs.length % tpls.length];
      const dur = durMins * 60 * 1000;
      const start = new Date(cursor).toISOString();
      const stop  = new Date(cursor + dur).toISOString();
      programs.push({
        channel: ch.id,
        title,
        start,
        stop,
        isNow: cursor <= nowMs && cursor + dur > nowMs,
      });
      cursor += dur;
    }

    return { channelId: ch.id, programs };
  });
}

const CATS = ['all','news','sports','entertainment','music','documentary','kids'];

export default function EPG() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [guides,   setGuides]   = useState<EpgGuide[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState('all');
  const [query,    setQuery]    = useState('');
  const [nowTick,  setNowTick]  = useState(new Date());
  const scrollRef  = useRef<HTMLDivElement>(null);
  const headerRef  = useRef<HTMLDivElement>(null);

  const now      = nowTick;
  const baseHour = new Date(now); baseHour.setHours(0,0,0,0);
  const baseMs   = baseHour.getTime();
  const nowOffsetX = HDR_W + timeToOffset(now.toISOString(), baseMs);

  // Tick clock every minute
  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAllChannels().then(all => {
      let filtered = category === 'all'
        ? all.slice(0, 50)
        : all.filter(ch => ch.categories.includes(category)).slice(0, 50);
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(ch => ch.name.toLowerCase().includes(q));
      }
      setChannels(filtered);
      setGuides(generateMockEpg(filtered));
      setLoading(false);
    });
  }, [category, query]);

  // Scroll to current time on load
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const x = nowOffsetX - HDR_W - 100;
      scrollRef.current.scrollLeft = Math.max(0, x);
    }
  }, [loading, nowOffsetX]); // `nowOffsetX` was missing from the dependency array, making the eslint-disable necessary, but if included, it is no longer needed.

  const handleScroll = () => {
    if (scrollRef.current && headerRef.current) {
      headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  };

  const totalW = 24 * 2 * SLOT_W;

  // Find current program for a channel
  function getNowProgram(channelId: string) {
    const guide = guides.find(g => g.channelId === channelId);
    return guide?.programs.find(p => p.isNow);
  }

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
    </div>
  );

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none px-4 pt-12 pb-3 border-b border-white/8 bg-black/95 backdrop-blur space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">TV Guide</h1>
            <p className="text-white/40 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </div>
          <button
            onClick={() => { setLoading(true); setGuides(generateMockEpg(channels)); setTimeout(() => setLoading(false), 300); }}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-white/8 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {CATS.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'flex-none text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors',
                category === c
                  ? 'bg-primary text-white'
                  : 'bg-white/8 text-white/60 hover:bg-white/15 hover:text-white'
              )}
            >
              {c === 'all' ? 'All Channels' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Time ruler */}
        <div className="flex-none border-b border-white/8 bg-gray-950 relative" style={{ height: 36 }}>
          <div className="absolute inset-0 flex overflow-hidden" style={{ paddingLeft: HDR_W }}>
            <div ref={headerRef} className="overflow-hidden flex-1" style={{ scrollBehavior: 'auto' }}>
              <div className="flex h-full" style={{ width: totalW }}>
                {HOURS.map(h => (
                  <div key={h} className="flex-none flex items-center border-l border-white/8 px-2" style={{ width: SLOT_W * 2 }}>
                    <span className="text-white/40 text-[10px] font-mono">{String(h).padStart(2,'0')}:00</span>
                    <span className="text-white/20 text-[10px] font-mono" style={{ marginLeft: SLOT_W - 22 }}>:30</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Now indicator on ruler */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-20 pointer-events-none"
            style={{ left: nowOffsetX - (scrollRef.current?.scrollLeft || 0) }}
          />
        </div>

        {/* Channel rows */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          onScroll={handleScroll}
          style={{ scrollBehavior: 'auto' }}
        >
          <div style={{ width: HDR_W + totalW, minHeight: channels.length * ROW_H }}>
            {/* Vertical time needle */}
            <div
              className="sticky top-0 bottom-0 w-0.5 bg-red-500/50 z-20 pointer-events-none"
              style={{ position: 'absolute', left: nowOffsetX, top: 0, bottom: 0 }}
            />

            {channels.map((ch) => {
              const guide = guides.find(g => g.channelId === ch.id);
              const nowProg = getNowProgram(ch.id);

              return (
                <div key={ch.id} className="flex border-b border-white/5" style={{ height: ROW_H }}>
                  {/* Channel column */}
                  <div
                    className="flex-none sticky left-0 z-10 flex items-center gap-2 px-3 bg-gray-950 border-r border-white/8"
                    style={{ width: HDR_W }}
                  >
                    {ch.logo ? (
                      <img src={ch.logo} alt={ch.name}
                        className="w-9 h-9 rounded-lg object-contain bg-white/5 p-0.5 flex-none"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-none">
                        <Tv2 className="w-4 h-4 text-primary/60" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs font-semibold truncate">{ch.name}</p>
                      {nowProg ? (
                        <p className="text-primary text-[9px] truncate">{nowProg.title}</p>
                      ) : (
                        <p className="text-white/30 text-[10px] truncate uppercase">{ch.countryCode}</p>
                      )}
                    </div>
                  </div>

                  {/* Programs row */}
                  <div className="relative" style={{ width: totalW, height: ROW_H }}>
                    {(guide?.programs || []).map((prog, pi) => {
                      const left  = timeToOffset(prog.start, baseMs);
                      const width = durationWidth(prog.start, prog.stop);
                      return (
                        <button
                          key={pi}
                          onClick={() => navigate(`/channel/${ch.id}`)}
                          className={cn(
                            'absolute top-1.5 bottom-1.5 rounded-xl px-2.5 flex flex-col justify-center overflow-hidden border transition-all hover:z-10 hover:scale-y-105',
                            prog.isNow
                              ? 'bg-primary/25 border-primary/50 hover:bg-primary/35'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          )}
                          style={{ left: left + 2, width: width - 4 }}
                        >
                          {prog.isNow && (
                            <div className="flex items-center gap-1 mb-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-none" />
                              <span className="text-primary text-[9px] font-bold uppercase">Now</span>
                            </div>
                          )}
                          <p className={cn('text-xs font-semibold truncate leading-tight', prog.isNow ? 'text-white' : 'text-white/70')}>
                            {prog.title}
                          </p>
                          <p className="text-white/25 text-[10px] truncate">
                            {formatTime(prog.start)} – {formatTime(prog.stop)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating clock */}
      <div className="fixed bottom-24 right-4 z-30 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur border border-white/15 text-white text-xs font-mono px-3 py-1.5 rounded-full">
          <Clock className="w-3 h-3 text-primary" />
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
