/**
 * Notification Center — full-page social notifications with read/unread,
 * mark all read, per-type icons, and deep links.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, Heart, Repeat2, MessageCircle, UserPlus,
  AtSign, Loader2, Check, CheckCheck, Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  user_id: string;
  actor_id?: string;
  type: string;
  post_id?: string;
  message: string;
  read: boolean;
  created_at: string;
  actor?: { username: string };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  const cfg: Record<string, { Icon: React.FC<{ className?: string }>; bg: string; color: string }> = {
    like:    { Icon: Heart,         bg: 'bg-rose-500/15',   color: 'text-rose-400'  },
    repost:  { Icon: Repeat2,       bg: 'bg-green-500/15',  color: 'text-green-400' },
    comment: { Icon: MessageCircle, bg: 'bg-blue-500/15',   color: 'text-blue-400'  },
    follow:  { Icon: UserPlus,      bg: 'bg-primary/15',    color: 'text-primary'   },
    dm:      { Icon: AtSign,        bg: 'bg-purple-500/15', color: 'text-purple-400' },
  };
  const { Icon, bg, color } = cfg[type] || { Icon: Bell, bg: 'bg-white/10', color: 'text-white/60' };
  return (
    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-none', bg)}>
      <Icon className={cn('w-4.5 h-4.5', color)} />
    </div>
  );
}

const FILTER_TYPES = [
  { id: 'all',     label: 'All'      },
  { id: 'like',    label: 'Likes'    },
  { id: 'repost',  label: 'Reposts'  },
  { id: 'comment', label: 'Comments' },
  { id: 'follow',  label: 'Follows'  },
  { id: 'dm',      label: 'DMs'      },
];

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifs,   setNotifs]   = useState<Notification[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [marking,  setMarking]  = useState(false);

  const loadNotifs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('social_notifications')
      .select('*, actor:actor_id(username)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80);
    setNotifs((data || []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const markAllRead = async () => {
    if (!user) return;
    setMarking(true);
    await supabase
      .from('social_notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setMarking(false);
  };

  const markOne = async (id: string) => {
    await supabase.from('social_notifications').update({ read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteOne = async (id: string) => {
    await supabase.from('social_notifications').delete().eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const handleClick = async (n: Notification) => {
    await markOne(n.id);
    if (n.type === 'dm') navigate('/social/dm');
    else if (n.actor_id && (n.type === 'follow')) navigate(`/social/profile/${n.actor_id}`);
    else if (n.post_id) navigate(`/social?post=${n.post_id}`);
    else navigate('/social');
  };

  const filtered = filter === 'all' ? notifs : notifs.filter(n => n.type === filter);
  const unread   = notifs.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-4 pt-12 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-foreground font-bold text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </h1>
            {unread > 0 && <p className="text-muted-foreground text-xs">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} disabled={marking}
              className="flex items-center gap-1.5 text-primary text-xs font-semibold hover:underline disabled:opacity-50">
              {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Mark all read
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {FILTER_TYPES.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn('flex-none text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
                filter === f.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {f.label}
              {f.id === 'all' && unread > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full inline-flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-8">
          <Bell className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-foreground font-semibold">No notifications</p>
          <p className="text-muted-foreground text-sm text-center">
            {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications yet`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {filtered.map(n => (
            <div key={n.id}
              className={cn('flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors relative',
                !n.read && 'bg-primary/5')}
              onClick={() => handleClick(n)}
            >
              {/* Unread dot */}
              {!n.read && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
              )}

              <NotifIcon type={n.type} />

              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm leading-snug">
                  {n.actor?.username && (
                    <span className="font-bold">@{n.actor.username} </span>
                  )}
                  {n.message}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">{timeAgo(n.created_at)}</p>
              </div>

              <div className="flex items-center gap-1 flex-none ml-2">
                {!n.read && (
                  <button
                    onClick={e => { e.stopPropagation(); markOne(n.id); }}
                    className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                  >
                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deleteOne(n.id); }}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
