import { X, Calendar, Clock, Loader2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEPG } from '@/hooks/useEPG';
import type { IPTVChannel } from '@/types';

interface Props {
  channel: IPTVChannel;
  onClose: () => void;
}

export default function ChannelSchedule({ channel, onClose }: Props) {
  const { programs, loading, current, next } = useEPG(channel.id, channel.name);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return '--:--'; }
  };

  const formatDuration = (start: string, stop: string) => {
    try {
      const mins = Math.round((new Date(stop).getTime() - new Date(start).getTime()) / 60_000);
      if (mins < 60) return `${mins}m`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    } catch { return ''; }
  };

  const isOnNow = (p: { start: string; stop: string }) => {
    const now = Date.now();
    return new Date(p.start).getTime() <= now && new Date(p.stop).getTime() > now;
  };

  const progressPct = (p: { start: string; stop: string }) => {
    const now   = Date.now();
    const start = new Date(p.start).getTime();
    const stop  = new Date(p.stop).getTime();
    return Math.min(100, Math.max(0, ((now - start) / (stop - start)) * 100));
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-white/10 rounded-t-3xl pb-safe slide-up max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            {channel.logo ? (
              <img src={channel.logo} alt={channel.name}
                className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Calendar className="w-4.5 h-4.5 text-white/60" />
              </div>
            )}
            <div>
              <h3 className="text-foreground font-bold text-sm leading-tight">{channel.name}</h3>
              <p className="text-foreground/40 text-[11px]">Programme Schedule</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-foreground/60" />
          </button>
        </div>

        {/* On Now Banner */}
        {current && (
          <div className="mx-5 mt-4 p-4 bg-primary/10 border border-primary/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary live-dot" />
              <span className="text-primary text-[10px] font-bold uppercase tracking-wider">On Now</span>
            </div>
            <p className="text-foreground font-semibold text-sm">{current.title}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-foreground/50 text-xs">
                {formatTime(current.start)} – {formatTime(current.stop)} · {formatDuration(current.start, current.stop)}
              </span>
              <span className="text-primary text-xs font-semibold">{Math.round(progressPct(current))}%</span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${progressPct(current)}%` }}
              />
            </div>
            {current.desc && (
              <p className="text-foreground/40 text-xs mt-2 line-clamp-2">{current.desc}</p>
            )}
          </div>
        )}

        {/* Up Next */}
        {next && (
          <div className="mx-5 mt-3 px-4 py-3 bg-white/4 border border-white/8 rounded-2xl flex items-center gap-3">
            <Clock className="w-4 h-4 text-secondary flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-foreground/40 text-[10px] block">Up Next · {formatTime(next.start)}</span>
              <p className="text-foreground/80 text-sm font-medium truncate">{next.title}</p>
            </div>
          </div>
        )}

        {/* Full schedule */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : programs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Radio className="w-10 h-10 text-foreground/20" />
              <p className="text-foreground/40 text-sm">No schedule available</p>
            </div>
          ) : (
            programs.map((prog, i) => {
              const live = isOnNow(prog);
              const past = new Date(prog.stop).getTime() < Date.now();
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl transition-colors',
                    live ? 'bg-primary/8 border border-primary/15' : 'hover:bg-white/4',
                    past && 'opacity-40'
                  )}
                >
                  {/* Time column */}
                  <div className="w-12 flex-shrink-0 pt-0.5">
                    <span className={cn(
                      'text-xs font-semibold leading-tight block',
                      live ? 'text-primary' : 'text-foreground/40'
                    )}>
                      {formatTime(prog.start)}
                    </span>
                    {live && (
                      <span className="text-[9px] text-primary font-bold uppercase">Live</span>
                    )}
                  </div>

                  {/* Program info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium leading-tight',
                      live ? 'text-foreground' : 'text-foreground/70'
                    )}>
                      {prog.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-foreground/30 text-[10px]">
                        {formatDuration(prog.start, prog.stop)}
                      </span>
                      {prog.category && (
                        <span className="text-[9px] bg-white/8 text-foreground/40 px-1.5 py-0.5 rounded-full capitalize">
                          {prog.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Live progress */}
                  {live && (
                    <div className="w-1 self-stretch bg-primary/20 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="w-full bg-primary rounded-full"
                        style={{ height: `${progressPct(prog)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
