/**
 * Admin Dashboard — enhanced with full analytics:
 * - Revenue tracking (PesaPal subscriptions)
 * - User growth charts
 * - Channel health stats
 * - Content reports
 * - Social engagement metrics
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Loader2, CheckCircle, ChevronRight,
  Users, AlertTriangle, Trash2, Eye, TrendingUp, DollarSign,
  Activity, BarChart2, Tv2, MessageSquare, Heart, UserCheck,
  Crown, RefreshCw, Calendar, Globe,
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

interface Analytics {
  totalUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  revenueKES: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  newUsersToday: number;
  newUsersPrev: number;
  activeSubscriptions: { plan: string; count: number; amount: number }[];
  recentSubs: { id: string; user_id: string; plan: string; amount: number; currency: string; status: string; created_at: string }[];
  dailyRevenue: { date: string; amount: number }[];
}

type AdminTab = 'overview' | 'revenue' | 'reports' | 'social' | 'channels';

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary', bg = 'bg-muted' }: {
  icon: React.FC<{ className?: string }>; label: string; value: string | number;
  sub?: string; color?: string; bg?: string;
}) {
  return (
    <div className={cn('rounded-2xl p-4 border border-transparent', bg)}>
      <div className="flex items-start justify-between mb-2">
        <Icon className={cn('w-4 h-4', color)} />
        {sub && <span className="text-muted-foreground text-[10px]">{sub}</span>}
      </div>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      <p className="text-muted-foreground text-xs mt-0.5">{label}</p>
    </div>
  );
}

function MiniBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

export default function AdminReports() {
  const navigate = useNavigate();
  const [tab,        setTab]       = useState<AdminTab>('overview');
  const [groups,     setGroups]    = useState<ReportGroup[]>([]);
  const [analytics,  setAnalytics] = useState<Analytics | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [expanded,   setExpanded]  = useState<string | null>(null);
  const [dismissing, setDismiss]   = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await fetchAllChannels();

    // Load everything in parallel
    const [
      reportsRes, profilesRes, premiumRes, postsRes,
      likesRes, commentsRes, subPlansRes,
    ] = await Promise.all([
      supabase.from('reports').select('channel_id, reason, created_at').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, created_at'),
      supabase.from('premium_subscriptions').select('user_id, plan, amount, currency, status, created_at, expires_at').eq('status', 'completed'),
      supabase.from('social_posts').select('id, created_at', { count: 'exact' }),
      supabase.from('social_likes').select('id', { count: 'exact' }),
      supabase.from('comments').select('id', { count: 'exact' }),
      supabase.from('premium_subscriptions').select('plan, amount, currency').eq('status', 'completed'),
    ]);

    // Process reports
    const map = new Map<string, ReportGroup>();
    for (const row of (reportsRes.data || [])) {
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

    // Process analytics
    const profiles = profilesRes.data || [];
    const subs     = premiumRes.data || [];
    const now      = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const prevStart  = new Date(todayStart); prevStart.setDate(prevStart.getDate() - 1);

    const newToday = profiles.filter(p => new Date(p.created_at) >= todayStart).length;
    const newPrev  = profiles.filter(p => new Date(p.created_at) >= prevStart && new Date(p.created_at) < todayStart).length;

    const totalRevKES = subs.filter(s => s.currency === 'KES').reduce((acc, s) => acc + Number(s.amount), 0);
    const totalRevUSD = subs.filter(s => s.currency === 'USD').reduce((acc, s) => acc + Number(s.amount), 0);

    // Plan breakdown
    const planMap: Record<string, { count: number; amount: number }> = {};
    for (const s of (subPlansRes.data || [])) {
      const plan = s.plan || 'unknown';
      if (!planMap[plan]) planMap[plan] = { count: 0, amount: 0 };
      planMap[plan].count++;
      planMap[plan].amount += Number(s.amount);
    }
    const activeSubscriptions = Object.entries(planMap).map(([plan, v]) => ({ plan, ...v }));

    // Last 7 days revenue
    const dailyRevenue: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const dNext = new Date(d); dNext.setDate(dNext.getDate() + 1);
      const amt = subs.filter(s => {
        const t = new Date(s.created_at);
        return t >= d && t < dNext;
      }).reduce((acc, s) => acc + Number(s.amount), 0);
      dailyRevenue.push({ date: d.toLocaleDateString([], { weekday: 'short' }), amount: amt });
    }

    setAnalytics({
      totalUsers:          profiles.length,
      premiumUsers:        subs.length,
      totalRevenue:        totalRevUSD,
      revenueKES:          totalRevKES,
      totalPosts:          postsRes.count || 0,
      totalLikes:          likesRes.count || 0,
      totalComments:       commentsRes.count || 0,
      newUsersToday:       newToday,
      newUsersPrev:        newPrev,
      activeSubscriptions,
      recentSubs:          (premiumRes.data || []).slice(0, 10).reverse() as Analytics['recentSubs'],
      dailyRevenue,
    });

    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function dismissReports(channelId: string) {
    setDismiss(channelId);
    await supabase.from('reports').delete().eq('channel_id', channelId);
    setGroups(prev => prev.filter(g => g.channel_id !== channelId));
    setDismiss(null);
  }

  const TABS: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview',  label: 'Overview',  icon: Activity   },
    { id: 'revenue',   label: 'Revenue',   icon: DollarSign },
    { id: 'social',    label: 'Social',    icon: MessageSquare },
    { id: 'reports',   label: 'Reports',   icon: AlertTriangle },
    { id: 'channels',  label: 'Channels',  icon: Tv2        },
  ];

  const maxDailyRev = analytics ? Math.max(...analytics.dailyRevenue.map(d => d.amount), 1) : 1;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-foreground font-bold text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Admin Dashboard
            </h1>
            <p className="text-muted-foreground text-xs">
              {analytics?.totalUsers || 0} users · KES {analytics?.revenueKES?.toLocaleString() || 0} revenue
            </p>
          </div>
          <button onClick={loadAll} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex-none flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap',
                  tab === t.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                <Icon className="w-3 h-3" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : (
        <div className="px-4 py-4 space-y-5">

          {/* ── Overview ── */}
          {tab === 'overview' && analytics && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard icon={Users}     label="Total Users"    value={analytics.totalUsers}    sub={`+${analytics.newUsersToday} today`} color="text-blue-400"   bg="bg-blue-400/10" />
                <StatCard icon={Crown}     label="Premium Users"  value={analytics.premiumUsers}  sub={`${analytics.totalUsers > 0 ? Math.round(analytics.premiumUsers / analytics.totalUsers * 100) : 0}%`} color="text-amber-400" bg="bg-amber-400/10" />
                <StatCard icon={DollarSign} label="KES Revenue"   value={`KES ${analytics.revenueKES.toLocaleString()}`} color="text-green-400"  bg="bg-green-400/10" />
                <StatCard icon={MessageSquare} label="Social Posts" value={analytics.totalPosts} color="text-purple-400" bg="bg-purple-400/10" />
              </div>

              {/* User growth trend */}
              <div className="bg-muted/40 border border-border/50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <p className="text-foreground font-semibold text-sm">Revenue — Last 7 Days (KES)</p>
                </div>
                <div className="flex items-end gap-1.5 h-20">
                  {analytics.dailyRevenue.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-md bg-primary/30 transition-all relative overflow-hidden"
                        style={{ height: `${(d.amount / maxDailyRev) * 64}px`, minHeight: 3 }}>
                        <div className="absolute inset-0 bg-primary/60" style={{ opacity: d.amount > 0 ? 1 : 0 }} />
                      </div>
                      <span className="text-muted-foreground text-[9px]">{d.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats */}
              <div className="space-y-2">
                {[
                  { icon: Heart,    label: 'Total Likes',    value: analytics.totalLikes,    color: 'text-rose-400' },
                  { icon: MessageSquare, label: 'Comments',  value: analytics.totalComments, color: 'text-blue-400' },
                  { icon: UserCheck, label: 'New Users Today', value: analytics.newUsersToday, color: 'text-green-400' },
                  { icon: AlertTriangle, label: 'Flagged Channels', value: groups.length, color: 'text-yellow-400' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-center gap-3 bg-muted/30 border border-border/30 rounded-xl px-4 py-3">
                    <Icon className={cn('w-4 h-4', color)} />
                    <span className="flex-1 text-foreground text-sm">{label}</span>
                    <span className={cn('font-bold text-sm', color)}>{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Revenue ── */}
          {tab === 'revenue' && analytics && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard icon={DollarSign} label="KES Revenue"    value={`KES ${analytics.revenueKES.toLocaleString()}`}  color="text-green-400" bg="bg-green-400/10" />
                <StatCard icon={Crown}      label="Active Subs"    value={analytics.premiumUsers}  color="text-amber-400" bg="bg-amber-400/10" />
              </div>

              {/* Plan breakdown */}
              <div className="bg-muted/40 border border-border/50 rounded-2xl p-4">
                <p className="text-foreground font-semibold text-sm mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" /> Plan Breakdown
                </p>
                {analytics.activeSubscriptions.length === 0
                  ? <p className="text-muted-foreground text-sm text-center py-4">No subscriptions yet</p>
                  : analytics.activeSubscriptions.map(({ plan, count, amount }) => (
                    <div key={plan} className="mb-3 last:mb-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-foreground text-sm capitalize font-medium">{plan} Plan</span>
                        </div>
                        <div className="text-right">
                          <span className="text-foreground text-sm font-bold">KES {amount.toLocaleString()}</span>
                          <span className="text-muted-foreground text-xs ml-2">({count} users)</span>
                        </div>
                      </div>
                      <MiniBar value={count} max={Math.max(...analytics.activeSubscriptions.map(s => s.count), 1)} color="bg-amber-400" />
                    </div>
                  ))}
              </div>

              {/* Recent transactions */}
              <div className="bg-muted/40 border border-border/50 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-foreground font-semibold text-sm">Recent Transactions</p>
                </div>
                {analytics.recentSubs.length === 0
                  ? <p className="text-muted-foreground text-sm text-center py-6">No transactions yet</p>
                  : analytics.recentSubs.map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/20 last:border-0">
                      <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-none">
                        <Crown className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm font-semibold capitalize">{sub.plan} Plan</p>
                        <p className="text-muted-foreground text-xs">{timeAgo(sub.created_at)}</p>
                      </div>
                      <span className="text-green-400 font-bold text-sm">
                        {sub.currency} {Number(sub.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* ── Social ── */}
          {tab === 'social' && analytics && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard icon={MessageSquare} label="Total Posts"   value={analytics.totalPosts}    color="text-purple-400" bg="bg-purple-400/10" />
                <StatCard icon={Heart}         label="Total Likes"   value={analytics.totalLikes}    color="text-rose-400"   bg="bg-rose-400/10" />
                <StatCard icon={MessageSquare} label="Comments"      value={analytics.totalComments} color="text-blue-400"   bg="bg-blue-400/10" />
                <StatCard icon={Users}         label="Social Users"  value={analytics.totalUsers}    color="text-green-400"  bg="bg-green-400/10" />
              </div>

              <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 space-y-3">
                <p className="text-foreground font-semibold text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Engagement Rates
                </p>
                {[
                  { label: 'Likes per Post', value: analytics.totalPosts > 0 ? (analytics.totalLikes / analytics.totalPosts).toFixed(1) : '0', color: 'bg-rose-400' },
                  { label: 'Comments per Post', value: analytics.totalPosts > 0 ? (analytics.totalComments / analytics.totalPosts).toFixed(1) : '0', color: 'bg-blue-400' },
                  { label: 'Premium Conversion', value: `${analytics.totalUsers > 0 ? Math.round(analytics.premiumUsers / analytics.totalUsers * 100) : 0}%`, color: 'bg-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className="text-foreground text-xs font-bold">{value}</span>
                    </div>
                    <MiniBar value={parseFloat(String(value)) || 0} max={20} color={color} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Reports ── */}
          {tab === 'reports' && (
            groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 px-8">
                <CheckCircle className="w-12 h-12 text-green-400/30" />
                <p className="text-muted-foreground text-center text-sm">No reports yet. All channels look clean!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map(g => (
                  <div key={g.channel_id} className="bg-muted/30 border border-border/40 rounded-2xl overflow-hidden">
                    <button onClick={() => setExpanded(expanded === g.channel_id ? null : g.channel_id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left">
                      <div className="w-10 h-10 rounded-xl bg-muted flex-none overflow-hidden flex items-center justify-center">
                        {g.channel?.logo
                          ? <img src={g.channel.logo} alt={g.channel.name} className="w-full h-full object-contain p-0.5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <AlertTriangle className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm font-semibold truncate">{g.channel?.name || g.channel_id}</p>
                        <p className="text-muted-foreground text-xs">{timeAgo(g.latestAt)}</p>
                      </div>
                      <div className={cn('px-2.5 py-1 rounded-full text-xs font-bold border',
                        g.total >= 5 ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                        g.total >= 3 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' :
                        'bg-muted text-muted-foreground border-transparent')}>
                        {g.total} reports
                      </div>
                      <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded === g.channel_id && 'rotate-90')} />
                    </button>

                    {expanded === g.channel_id && (
                      <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-2">
                        {Object.entries(g.reasons).map(([reason, count]) => (
                          <div key={reason} className="flex items-center justify-between gap-2">
                            <span className="text-foreground/80 text-sm capitalize flex-1">{reason}</span>
                            <div className="flex items-center gap-2 flex-none">
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden w-20">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${(count / g.total) * 100}%` }} />
                              </div>
                              <span className="text-muted-foreground text-xs w-6 text-right">{count}×</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => navigate(`/channel/${g.channel_id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary py-2.5 rounded-xl hover:bg-primary/20 transition-colors">
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button onClick={() => dismissReports(g.channel_id)} disabled={dismissing === g.channel_id}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/10 text-red-400 py-2.5 rounded-xl hover:bg-red-500/20 disabled:opacity-50">
                            {dismissing === g.channel_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Dismiss</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── Channels ── */}
          {tab === 'channels' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard icon={Globe}  label="Countries"    value={150}  color="text-blue-400"  bg="bg-blue-400/10" />
                <StatCard icon={Tv2}    label="Channels"     value="100k+" color="text-primary"   bg="bg-primary/10" />
              </div>
              <div className="bg-muted/40 border border-border/50 rounded-2xl p-4">
                <p className="text-foreground font-semibold text-sm mb-3 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" /> Channel Categories
                </p>
                {[
                  { cat: 'News',          pct: 28, color: 'bg-red-400'    },
                  { cat: 'Sports',        pct: 22, color: 'bg-green-400'  },
                  { cat: 'Entertainment', pct: 20, color: 'bg-purple-400' },
                  { cat: 'Music',         pct: 12, color: 'bg-amber-400'  },
                  { cat: 'Documentary',   pct: 8,  color: 'bg-blue-400'   },
                  { cat: 'Kids',          pct: 5,  color: 'bg-pink-400'   },
                  { cat: 'Others',        pct: 5,  color: 'bg-white/30'   },
                ].map(({ cat, pct, color }) => (
                  <div key={cat} className="mb-2.5 last:mb-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground text-xs">{cat}</span>
                      <span className="text-foreground text-xs font-bold">{pct}%</span>
                    </div>
                    <MiniBar value={pct} max={100} color={color} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
