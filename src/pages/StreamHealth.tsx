import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wifi, WifiOff, Loader2, Activity, CheckCircle,
  XCircle, Clock, Download, Filter
} from 'lucide-react';
import { fetchAllChannels } from '@/lib/iptvApi';
import { checkStreamHealth, type HealthStatus } from '@/hooks/useStreamHealth';
import { cn } from '@/lib/utils';
import type { IPTVChannel } from '@/types';

interface ChannelHealth {
  channel:   IPTVChannel;
  status:    HealthStatus;
  latencyMs: number | null;
}

const STATUS_ICON: Record<HealthStatus, React.ReactNode> = {
  online:   <CheckCircle className="w-4 h-4 text-green-400" />,
  offline:  <XCircle    className="w-4 h-4 text-red-400" />,
  checking: <Loader2    className="w-4 h-4 text-yellow-400 animate-spin" />,
  unknown:  <Clock      className="w-4 h-4 text-white/30" />,
};

const STATUS_LABEL_COLOR: Record<HealthStatus, string> = {
  online:   'text-green-400',
  offline:  'text-red-400',
  checking: 'text-yellow-400',
  unknown:  'text-muted-foreground',
};

export default function StreamHealth() {
  const navigate  = useNavigate();
  const [all,     setAll]     = useState<ChannelHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter,  setFilter]  = useState<'all' | 'online' | 'offline' | 'checking'>('all');
  const [checked, setChecked] = useState(0);
  const [sortBy,  setSortBy]  = useState<'default' | 'latency'>('default');
  const abortRef  = useRef(false);

  useEffect(() => {
    fetchAllChannels().then(channels => {
      const sample = channels.slice(0, 100);
      setAll(sample.map(c => ({ channel: c, status: 'unknown', latencyMs: null })));
      setLoading(false);
    });
  }, []);

  const runHealthCheck = useCallback(async () => {
    if (running) { abortRef.current = true; setRunning(false); return; }
    abortRef.current = false;
    setRunning(true);
    setChecked(0);
    setAll(prev => prev.map(h => ({ ...h, status: 'checking', latencyMs: null })));

    const items = all.map(h => h.channel);

    for (let i = 0; i < items.length; i += 10) {
      if (abortRef.current) break;
      const batch = items.slice(i, i + 10);

      const results = await Promise.all(
        batch.map(async ch => {
          const t0 = Date.now();
          const status = await checkStreamHealth(ch.streamUrl);
          const latencyMs = status === 'online' ? Date.now() - t0 : null;
          return { status, latencyMs };
        })
      );

      setAll(prev => {
        const updated = [...prev];
        batch.forEach((ch, bi) => {
          const idx = updated.findIndex(h => h.channel.id === ch.id);
          if (idx !== -1) updated[idx] = { ...updated[idx], ...results[bi] };
        });
        return updated;
      });

      setChecked(c => c + batch.length);
    }

    setRunning(false);
  }, [running, all]);

  function exportCSV() {
    const rows = [
      ['Channel', 'Country', 'Status', 'Latency (ms)', 'Stream URL'],
      ...all.map(h => [
        h.channel.name,
        h.channel.countryCode,
        h.status,
        h.latencyMs?.toString() || '',
        h.channel.streamUrl,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `stream-health-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const online   = all.filter(h => h.status === 'online').length;
  const offline  = all.filter(h => h.status === 'offline').length;
  const progress = all.length > 0 ? Math.round((checked / all.length) * 100) : 0;

  let filtered = all.filter(h => filter === 'all' || h.status === filter);
  if (sortBy === 'latency') {
    filtered = [...filtered].sort((a, b) => {
      if (a.latencyMs === null && b.latencyMs === null) return 0;
      if (a.latencyMs === null) return 1;
      if (b.latencyMs === null) return -1;
      return a.latencyMs - b.latencyMs;
    });
  }

  if (loading) return (
    <div className="h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-background/95 backdrop-blur border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-foreground font-bold text-lg">Stream Health</h1>
            <p className="text-muted-foreground text-xs">
              {running ? `Testing ${checked}/${all.length}…` : `${all.length} channels monitored`}
            </p>
          </div>
          {/* Export CSV */}
          <button
            onClick={exportCSV}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
          {/* Run / Stop */}
          <button
            onClick={runHealthCheck}
            className={cn(
              'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-all',
              running
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-primary text-white hover:bg-primary/90'
            )}
          >
            {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Stop</> : <><Activity className="w-4 h-4" /> Run Test</>}
          </button>
        </div>

        {/* Progress bar */}
        {running && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Online',  value: online,      color: 'text-green-400', bg: 'bg-green-400/10',  f: 'online'  as const },
            { label: 'Offline', value: offline,     color: 'text-red-400',   bg: 'bg-red-400/10',    f: 'offline' as const },
            { label: 'Total',   value: all.length,  color: 'text-foreground', bg: 'bg-muted',        f: 'all'     as const },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setFilter(s.f)}
              className={cn(
                'rounded-xl p-3 text-center transition-all border',
                filter === s.f
                  ? `${s.bg} border-current/50 ${s.color}`
                  : 'bg-muted border-transparent text-muted-foreground hover:border-border'
              )}
            >
              <p className={cn('text-xl font-bold', filter === s.f && s.color)}>{s.value}</p>
              <p className="text-xs mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Filters + sort */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {(['all','online','offline','checking'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-none text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors',
                filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex-none">
            <button
              onClick={() => setSortBy(s => s === 'default' ? 'latency' : 'default')}
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
                sortBy === 'latency' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <Filter className="w-3 h-3" />
              {sortBy === 'latency' ? 'By Latency' : 'Default'}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {filtered.map(({ channel, status, latencyMs }) => (
          <div key={channel.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-muted flex-none overflow-hidden flex items-center justify-center">
              {channel.logo ? (
                <img src={channel.logo} alt={channel.name}
                  className="w-full h-full object-contain p-0.5"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <Wifi className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-semibold truncate">{channel.name}</p>
              <p className="text-muted-foreground text-xs truncate">{channel.countryCode} · {channel.streamUrl.slice(0, 45)}…</p>
            </div>

            <div className="flex items-center gap-2 flex-none">
              {/* Latency pill */}
              {latencyMs !== null && (
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  latencyMs < 1000  ? 'bg-green-400/10 text-green-400'  :
                  latencyMs < 3000  ? 'bg-yellow-400/10 text-yellow-400' :
                                      'bg-red-400/10 text-red-400'
                )}>
                  {latencyMs}ms
                </span>
              )}
              {STATUS_ICON[status]}
              <span className={cn('text-xs font-semibold capitalize', STATUS_LABEL_COLOR[status])}>
                {status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !running && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Activity className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Run a health check to see stream status.</p>
        </div>
      )}
    </div>
  );
}
