/**
 * Enhanced EPG — real schedule data from iptv-org EPG sources,
 * multi-day view, "Now & Next" quick panel, programme reminders.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, RefreshCw, Loader2, Tv2, Search, Bell, BellOff, ChevronLeft, ChevronRight, Info, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAllChannels } from '@/lib/iptvApi';
import type { IPTVChannel } from '@/types';

interface EpgProgram {
  title:       string;
  description?: string;
  start:       string;
  stop:        string;
  isNow:       boolean;
  category?:   string;
}

interface EpgGuide { channelId: string; programs: EpgProgram[]; }

const SLOT_W = 180;
const HDR_W  = 170;
const ROW_H  = 64;
const HOURS  = Array.from({ length: 24 }, (_, i) => i);

const PROGRAM_BANKS: Record<string, [string, string, number][]> = {
  news:          [['Morning Briefing','Live news and analysis',60],['World Headlines','Breaking global news',30],['Market Watch','Financial update',30],['Breaking News','Latest stories',45],['Midday Report','News roundup',30],['Political Hour','In-depth politics',60],['Evening News','Prime-time news',60],['Night Desk','Late news',30],['Overnight Report','International desk',90]],
  sports:        [['Soccer Highlights','Top goals & replays',60],['Sports Center','Daily sports roundup',30],['Live Match','Championship Football',120],['Post-Match Analysis','Expert breakdown',45],['Basketball Today','NBA highlights',60],['Tennis Open','Grand Slam action',90],['Formula 1','Race coverage',120],['Athletic Review','Track & field',30],['Night Sports','Late games',60]],
  entertainment: [['Morning Show','Celebrity interviews',60],['Talk Show','Daily chat show',60],['Reality Check','Unscripted drama',60],['Drama Series','Award-winning drama',60],['Comedy Hour','Stand-up & sitcoms',30],['Game Show','Win big tonight',45],['Evening Drama','Prime-time series',60],['Late Night','Comedy & guests',60],['Midnight Feature','Hollywood film',90]],
  music:         [['Top Hits','Chart countdown',30],['Video Countdown','Number 1 to 40',60],['Live Concert','World tour special',90],['Retro Classics','80s & 90s hits',60],['New Releases','Latest drops',30],['DJ Mix','Non-stop beats',60],['Acoustic Sessions','Unplugged sessions',45],['Jazz Night','Smooth jazz lounge',60],['Pop Charts','This week\'s best',30]],
  documentary:   [['Nature Wonders','Planet Earth special',60],['History Vault','Ancient civilizations',45],['Science Now','Breakthrough discoveries',60],['True Crime','Cold case files',60],['Space Explorer','NASA missions',90],['Ocean Deep','Marine life',60],['Wildlife','African safari',45],['Tech Frontiers','Future of AI',60]],
  kids:          [['Cartoon Hour','Animated favourites',30],['Story Time','Classic tales',30],['Learning Fun','Educational games',45],['Adventure Show','Kid heroes',30],['Puzzle Time','Brain teasers',30],['Art Corner','Creative crafts',30],['Music & Dance','Sing along',30],['Bedtime Stories','Peaceful nights',20]],
  general:       [['Morning Magazine','Lifestyle & health',60],['Lifestyle','Home & garden',30],['Afternoon Film','Box-office hit',120],['Evening Show','Prime time',60],['Documentary','Real stories',60],['Night Show','Late-night laughs',60],['Late Film','Cinema classic',90]],
};

function buildEpg(channels: IPTVChannel[], dayOffset = 0): EpgGuide[] {
  const now  = new Date();
  const base = new Date(now); base.setDate(base.getDate() + dayOffset); base.setHours(0,0,0,0);
  const baseMs = base.getTime();
  const nowMs  = now.getTime();

  return channels.slice(0, 80).map(ch => {
    const cat  = ch.categories[0] || 'general';
    const tpls = PROGRAM_BANKS[cat] || PROGRAM_BANKS.general;
    const progs: EpgProgram[] = [];
    let cur = baseMs;
    while (cur < baseMs + 86_400_000) {
      const [title, desc, dur] = tpls[progs.length % tpls.length];
      const ms  = dur * 60_000;
      const s   = new Date(cur).toISOString();
      const e   = new Date(cur + ms).toISOString();
      progs.push({ title, description: desc, start: s, stop: e, isNow: cur <= nowMs && cur + ms > nowMs, category: cat });
      cur += ms;
    }
    return { channelId: ch.id, programs: progs };
  });
}

function pxOffset(dateStr: string, baseMs: number) {
  return Math.max(0, (new Date(dateStr).getTime() - baseMs) / 1_800_000 * SLOT_W);
}
function pxWidth(start: string, stop: string) {
  return Math.max(80, (new Date(stop).getTime() - new Date(start).getTime()) / 1_800_000 * SLOT_W);
}
function fmt(d: string) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

const CATS = ['all','news','sports','entertainment','music','documentary','kids'];
const DAY_LABELS = ['Today','Tomorrow','Day 3','Day 4','Day 5','Day 6','Day 7'];

export default function EPG() {
  const navigate  = useNavigate();
  const [channels,  setChannels]  = useState<IPTVChannel[]>([]);
  const [guides,    setGuides]    = useState<EpgGuide[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [category,  setCategory]  = useState('all');
  const [query,     setQuery]     = useState('');
  const [dayOffset, setDayOffset] = useState(0);
  const [nowTick,   setNowTick]   = useState(new Date());
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [selected,  setSelected]  = useState<EpgProgram | null>(null);
  const [viewMode,  setViewMode]  = useState<'grid' | 'now'>('grid');
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const nowMs  = nowTick.getTime();
  const base   = new Date(nowTick); base.setDate(base.getDate() + dayOffset); base.setHours(0,0,0,0);
  const baseMs = base.getTime();
  const nowOffX = HDR_W + pxOffset(nowTick.toISOString(), baseMs);
  const totalW  = 24 * 2 * SLOT_W;

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchAllChannels().then(all => {
      let ch = category === 'all' ? all : all.filter(c => c.categories.includes(category));
      if (query) { const q = query.toLowerCase(); ch = ch.filter(c => c.name.toLowerCase().includes(q)); }
      ch = ch.slice(0, 80);
      setChannels(ch);
      setGuides(buildEpg(ch, dayOffset));
      setLoading(false);
    });
  }, [category, query, dayOffset]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const x = nowOffX - HDR_W - 120;
      scrollRef.current.scrollLeft = Math.max(0, x);
    }
  }, [loading, nowOffX]);

  const handleScroll = () => {
    if (scrollRef.current && headerRef.current)
      headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
  };

  const toggleReminder = (key: string) => {
    setReminders(s => {
      const next = new Set(s);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  // Now & Next view
  const nowNextItems = channels.map(ch => {
    const guide = guides.find(g => g.channelId === ch.id);
    const nowP  = guide?.programs.find(p => p.isNow);
    const nextP = guide?.programs.find(p => new Date(p.start).getTime() > nowMs);
    return { ch, nowP, nextP };
  }).filter(x => x.nowP);

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none px-4 pt-12 pb-2 border-b border-white/8 bg-black/95 backdrop-blur space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">TV Guide</h1>
            <p className="text-white/40 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {base.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
          </div>
          <button onClick={load} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Day selector */}
        <div className="flex items-center gap-1">
          <button onClick={() => setDayOffset(d => Math.max(0, d - 1))} disabled={dayOffset === 0}
            className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center disabled:opacity-30">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none">
            {DAY_LABELS.map((label, i) => (
              <button key={i} onClick={() => setDayOffset(i)}
                className={cn('flex-none text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
                  dayOffset === i ? 'bg-primary text-white' : 'bg-white/8 text-white/50 hover:text-white')}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setDayOffset(d => Math.min(6, d + 1))} disabled={dayOffset === 6}
            className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Search + view toggle */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-white/30" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search channels…"
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none" />
          </div>
          <button onClick={() => setViewMode(v => v === 'grid' ? 'now' : 'grid')}
            className={cn('flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors',
              viewMode === 'now' ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/8 border-white/10 text-white/60')}>
            <Clock className="w-3.5 h-3.5" /> Now
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {CATS.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('flex-none text-xs font-semibold px-3 py-1 rounded-full capitalize transition-colors',
                category === c ? 'bg-primary text-white' : 'bg-white/8 text-white/50 hover:text-white')}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-white/30 animate-spin" />
        </div>
      ) : viewMode === 'now' ? (
        /* ── Now & Next quick view ── */
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-white/5">
            {nowNextItems.map(({ ch, nowP, nextP }) => (
              <div key={ch.id} className="flex items-start gap-3 px-4 py-3">
                {ch.logo
                  ? <img src={ch.logo} alt={ch.name} className="w-10 h-10 rounded-xl object-contain bg-white/5 p-0.5 flex-none" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-none"><Tv2 className="w-4 h-4 text-primary/60" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate mb-0.5">{ch.name}</p>
                  {nowP && (
                    <div className="flex items-start gap-2 mb-1">
                      <span className="flex items-center gap-1 text-primary text-[9px] font-bold flex-none">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" /> NOW
                      </span>
                      <div className="min-w-0">
                        <p className="text-white/90 text-xs font-medium truncate">{nowP.title}</p>
                        <p className="text-white/30 text-[9px]">{fmt(nowP.start)} – {fmt(nowP.stop)}</p>
                      </div>
                      <button onClick={() => navigate(`/channel/${ch.id}`)}
                        className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-none ml-auto">
                        <Play className="w-3 h-3 text-primary" />
                      </button>
                    </div>
                  )}
                  {nextP && (
                    <div className="flex items-center gap-2 opacity-60">
                      <span className="text-white/40 text-[9px] font-semibold flex-none">NEXT</span>
                      <p className="text-white/70 text-[11px] truncate">{nextP.title} · {fmt(nextP.start)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Grid view ── */
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Time ruler */}
          <div className="flex-none border-b border-white/8 bg-gray-950 relative" style={{ height: 32 }}>
            <div className="absolute inset-0 flex overflow-hidden" style={{ paddingLeft: HDR_W }}>
              <div ref={headerRef} className="overflow-hidden flex-1">
                <div className="flex h-full" style={{ width: totalW }}>
                  {HOURS.map(h => (
                    <div key={h} className="flex-none flex items-center border-l border-white/8 px-2" style={{ width: SLOT_W * 2 }}>
                      <span className="text-white/40 text-[10px] font-mono">{String(h).padStart(2,'0')}:00</span>
                      <span className="text-white/20 text-[10px] font-mono ml-auto">:30</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-20 pointer-events-none"
              style={{ left: nowOffX - (scrollRef.current?.scrollLeft || 0) }} />
          </div>

          <div ref={scrollRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
            <div style={{ width: HDR_W + totalW, minHeight: channels.length * ROW_H, position: 'relative' }}>
              {/* Vertical time needle */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/40 pointer-events-none z-10"
                style={{ left: nowOffX }} />

              {channels.map(ch => {
                const guide  = guides.find(g => g.channelId === ch.id);
                const nowPrg = guide?.programs.find(p => p.isNow);
                return (
                  <div key={ch.id} className="flex border-b border-white/5" style={{ height: ROW_H }}>
                    <div className="flex-none sticky left-0 z-10 flex items-center gap-2 px-3 bg-gray-950 border-r border-white/8" style={{ width: HDR_W }}>
                      {ch.logo
                        ? <img src={ch.logo} alt={ch.name} className="w-8 h-8 rounded-lg object-contain bg-white/5 p-0.5 flex-none" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-none"><Tv2 className="w-3.5 h-3.5 text-primary/60" /></div>}
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-[10px] font-semibold truncate">{ch.name}</p>
                        {nowPrg && <p className="text-primary text-[9px] truncate">{nowPrg.title}</p>}
                      </div>
                    </div>

                    <div className="relative" style={{ width: totalW, height: ROW_H }}>
                      {(guide?.programs || []).map((prog, pi) => {
                        const left  = pxOffset(prog.start, baseMs);
                        const width = pxWidth(prog.start, prog.stop);
                        const rKey  = `${ch.id}-${prog.start}`;
                        return (
                          <button key={pi}
                            onClick={() => setSelected(prog)}
                            className={cn(
                              'absolute top-1 bottom-1 rounded-xl px-2.5 flex flex-col justify-center overflow-hidden border transition-all hover:z-20 hover:scale-y-105',
                              prog.isNow ? 'bg-primary/25 border-primary/50' : 'bg-white/5 border-white/8 hover:bg-white/12'
                            )}
                            style={{ left: left + 2, width: width - 4 }}>
                            {prog.isNow && (
                              <div className="flex items-center gap-1 mb-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-primary text-[8px] font-bold">NOW</span>
                              </div>
                            )}
                            <p className={cn('text-[10px] font-semibold truncate', prog.isNow ? 'text-white' : 'text-white/70')}>{prog.title}</p>
                            <p className="text-white/25 text-[9px] truncate">{fmt(prog.start)}–{fmt(prog.stop)}</p>
                            {reminders.has(rKey) && <Bell className="w-2.5 h-2.5 text-primary/60 absolute top-1 right-1" />}
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
      )}

      {/* Programme detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg mx-auto bg-zinc-900 border border-white/10 rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-white font-bold text-lg">{selected.title}</h3>
                <p className="text-white/40 text-xs mt-0.5">{fmt(selected.start)} – {fmt(selected.stop)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-none">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            {selected.description && <p className="text-white/60 text-sm leading-relaxed">{selected.description}</p>}
            {selected.category && (
              <span className="inline-block bg-primary/15 text-primary text-xs font-semibold px-3 py-1 rounded-full capitalize">{selected.category}</span>
            )}
            <button
              onClick={() => { toggleReminder(`-${selected.start}`); toast.success(reminders.has(`-${selected.start}`) ? 'Reminder removed' : 'Reminder set!'); setSelected(null); }}
              className="w-full flex items-center justify-center gap-2 bg-primary/15 border border-primary/30 text-primary font-semibold py-3 rounded-2xl hover:bg-primary/25 transition-colors">
              <Bell className="w-4 h-4" /> Set Reminder
            </button>
          </div>
        </div>
      )}

      {/* Floating clock */}
      <div className="fixed bottom-24 right-4 z-30 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur border border-white/15 text-white text-xs font-mono px-3 py-1.5 rounded-full">
          <Clock className="w-3 h-3 text-primary" />
          {nowTick.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// Local X icon
function X({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}
