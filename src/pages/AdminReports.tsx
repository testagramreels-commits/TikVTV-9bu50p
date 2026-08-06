import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Loader2, CheckCircle, ChevronRight,
  Users, AlertTriangle, BarChart2, Trash2, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllChannels, getChannelById } from '@/lib/iptvApi';
import { cn, timeAgo } from '@/lib/utils';
import type { IPTVChannel } from '@/types';

interface ReportGroup {
  channel_id: string;
  channel?: IPTVChannel;
  total: number;
  reasons: Record<string, number>;
  latestAt: string;
}

type AdminTab = 'reports' | 'stats';

export default function AdminReports() {
  const navigate            = useNavigate();
  const [groups,   setGroups]   = useState<ReportGroup[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab,      setTab]      = useState<AdminTab>('reports');
  const [dismissing, setDismissing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchAllChannels();

    const { data, error } = await supabase
      .from('reports')
      .select('channel_id, reason, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) { setLoading(false); return; }

    const map = new Map<string, ReportGroup>();
    for (const row of data) {
      const ex = map.get(row.channel_id);
      if (ex) {
        ex.total++;
        ex.reasons[row.reason] = (ex.reasons[row.reason] || 0) + 1;
        if (row.created_at > ex.latestAt) ex.latestAt = row.created_at;
      } else {
        map.set(row.channel_id, {
          channel_id: row.channel_id,
          channel: getChannelById(row.channel_id),
          total: 1,
          reasons: { [row.reason]: 1 },
          latestAt: row.created_at,
        });
      }
    }

    setGroups(Array.from(map.values()).sort((a, b) => b.total - a.total));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function dismissReports(channelId: string) {
    setDismissing(channelId);
    await supabase.from('reports').delete().eq('channel_id', channelId);
    setGroups(prev => prev.filter(g => g.channel_id !== channelId));
    setDismissing(null);
  }

  const totalReports = groups.reduce((s, g) => s + g.total, 0);
  const highPriority = groups.filter(g => g.total >= 3).length;
  const allReasons   = groups.flatMap(g => Object.entries(g.reasons));
  const reasonCounts: Record<string, number> = {};
  allReasons.forEach(([r, c]) => { reasonCounts[r] = (reasonCounts[r] || 0) + c; });
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxReasonCount = topReasons[0]?.[1] || 1;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-foreground font-bold text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground text-xs">
              {totalReports} reports · {highPriority} high priority
            </p>
          </div>
          <button onClick={load}
            className="text-xs text-primary font-semibold px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Total Reports',    value: totalReports, color: 'text-foreground',  bg: 'bg-muted' },
            { label: 'Channels Flagged', value: groups.length, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            { label: 'High Priority',    value: highPriority,  color: 'text-red-400',    bg: 'bg-red-400/10' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl p-3 text-center border border-transparent', s.bg)}>
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-muted-foreground text-[10px] leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['reports', 'stats'] as AdminTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors',
                tab === t ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t === 'reports' ? <><Users className="w-3 h-3" /> Reports</> : <><BarChart2 className="w-3 h-3" /> Analytics</>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : tab === 'stats' ? (
        /* ── Analytics tab ─────────────────────────────── */
        <div className="px-4 py-4 space-y-6">
          <div>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-3">Top Report Reasons</p>
            <div className="space-y-3">
              {topReasons.map(([reason, count]) => (
                <div key={reason}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-foreground text-sm capitalize">{reason}</p>
                    <span className="text-muted-foreground text-xs">{count}×</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                      style={{ width: `${(count / maxReasonCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {topReasons.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No reports yet.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-3">Priority Breakdown</p>
            <div className="space-y-2">
              {[
                { label: 'Critical (5+ reports)',  count: groups.filter(g => g.total >= 5).length, color: 'text-red-400', bg: 'bg-red-400/10' },
                { label: 'High (3–4 reports)',      count: groups.filter(g => g.total >= 3 && g.total < 5).length, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                { label: 'Low (1–2 reports)',       count: groups.filter(g => g.total < 3).length, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              ].map(s => (
                <div key={s.label} className={cn('flex items-center justify-between px-4 py-3 rounded-xl border border-transparent', s.bg)}>
                  <p className={cn('text-sm font-semibold', s.color)}>{s.label}</p>
                  <span className={cn('text-xl font-bold', s.color)}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : groups.length === 0 ? (
        /* ── Empty reports ─────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-24 gap-3 px-8">
          <CheckCircle className="w-12 h-12 text-green-400/30" />
          <p className="text-muted-foreground text-center">No reports yet. All channels are clean!</p>
        </div>
      ) : (
        /* ── Reports list ──────────────────────────────── */
        <div className="divide-y divide-border">
          {groups.map(g => (
            <div key={g.channel_id}>
              <button
                onClick={() => setExpanded(expanded === g.channel_id ? null : g.channel_id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex-none overflow-hidden flex items-center justify-center">
                  {g.channel?.logo ? (
                    <img src={g.channel.logo} alt={g.channel.name}
                      className="w-full h-full object-contain p-0.5"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-semibold truncate">
                    {g.channel?.name || g.channel_id}
                  </p>
                  <p className="text-muted-foreground text-xs truncate">
                    {g.channel?.countryCode} · {timeAgo(g.latestAt)}
                  </p>
                </div>

                <div className={cn(
                  'flex items-center gap-1.5 flex-none px-2.5 py-1 rounded-full text-xs font-bold border',
                  g.total >= 5 ? 'bg-red-500/15 text-red-400 border-red-500/25'    :
                  g.total >= 3 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' :
                  'bg-muted text-muted-foreground border-transparent'
                )}>
                  <Users className="w-3 h-3" />
                  {g.total}
                </div>

                <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform',
                  expanded === g.channel_id && 'rotate-90')} />
              </button>

              {expanded === g.channel_id && (
                <div className="px-4 pb-4 bg-muted/20">
                  <div className="pl-[52px] space-y-3">
                    <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider pt-2">
                      Report breakdown
                    </p>
                    {Object.entries(g.reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between gap-2">
                        <p className="text-foreground/80 text-sm flex-1 capitalize">{reason}</p>
                        <div className="flex items-center gap-2 flex-none">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden" style={{ width: 80 }}>
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(100, (count / g.total) * 100)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs w-8 text-right">{count}×</span>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => navigate(`/channel/${g.channel_id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary py-2.5 rounded-xl hover:bg-primary/20 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Channel
                      </button>
                      <button
                        onClick={() => dismissReports(g.channel_id)}
                        disabled={dismissing === g.channel_id}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/10 text-red-400 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {dismissing === g.channel_id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <><Trash2 className="w-3.5 h-3.5" /> Dismiss</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
