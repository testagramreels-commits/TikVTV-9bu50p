/**
 * Social user profile page — shows user posts, followers/following, bio.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserPlus, UserMinus, MessageCircle,
  Calendar, Loader2, BadgeCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import type { SocialPost, SocialUserProfile } from '@/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function SocialProfile() {
  const { userId }   = useParams<{ userId: string }>();
  const navigate     = useNavigate();
  const { user }     = useAuthStore();
  const [profile,  setProfile]   = useState<SocialUserProfile | null>(null);
  const [posts,    setPosts]     = useState<SocialPost[]>([]);
  const [stats,    setStats]     = useState({ posts: 0, followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [loading,  setLoading]   = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const targetId = userId || user?.id;

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    Promise.all([
      supabase.from('user_profiles').select('*').eq('id', targetId).single(),
      supabase.from('social_posts').select('*, user_profiles(id,username,email)').eq('user_id', targetId).order('created_at', { ascending: false }).limit(20),
      supabase.from('social_follows').select('id', { count: 'exact' }).eq('following_id', targetId),
      supabase.from('social_follows').select('id', { count: 'exact' }).eq('follower_id', targetId),
    ]).then(([{ data: p }, { data: ps, count: postCount }, { count: followerCount }, { count: followingCount }]) => {
      setProfile(p as SocialUserProfile);
      setPosts((ps || []) as SocialPost[]);
      setStats({ posts: postCount ?? 0, followers: followerCount ?? 0, following: followingCount ?? 0 });
      setLoading(false);
    });

    // Check if current user follows this profile
    if (user && user.id !== targetId) {
      supabase.from('social_follows').select('id').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle()
        .then(({ data }) => setFollowing(!!data));
    }
  }, [targetId, user]);

  const toggleFollow = async () => {
    if (!user || !targetId || user.id === targetId) return;
    setFollowLoading(true);
    if (following) {
      await supabase.from('social_follows').delete().match({ follower_id: user.id, following_id: targetId });
      setFollowing(false);
      setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }));
    } else {
      await supabase.from('social_follows').insert({ follower_id: user.id, following_id: targetId });
      setFollowing(true);
      setStats(s => ({ ...s, followers: s.followers + 1 }));
    }
    setFollowLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Profile not found</p>
    </div>
  );

  const init = (profile.username || profile.email || '?').slice(0, 1).toUpperCase();
  const isOwn = user?.id === profile.id;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-4 pt-safe-top pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-foreground text-sm">@{profile.username}</p>
          <p className="text-muted-foreground text-xs">{stats.posts} posts</p>
        </div>
        {!isOwn && user && (
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className={cn(
              'flex items-center gap-1.5 font-bold text-sm px-4 py-2 rounded-full transition-all',
              following
                ? 'bg-muted text-foreground border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40'
                : 'bg-primary text-white hover:bg-primary/90'
            )}
          >
            {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
              following ? <><UserMinus className="w-4 h-4" /> Following</> :
              <><UserPlus className="w-4 h-4" /> Follow</>}
          </button>
        )}
        {!isOwn && user && (
          <button onClick={() => navigate('/social/dm')}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-foreground" />
          </button>
        )}
      </div>

      {/* Profile card */}
      <div className="px-4 py-5 border-b border-border/40">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-2xl flex-none">
            {init}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h2 className="font-bold text-foreground text-lg leading-tight">@{profile.username}</h2>
              <BadgeCheck className="w-4 h-4 text-primary flex-none" />
            </div>
            <p className="text-muted-foreground text-sm">{profile.email}</p>
            <div className="flex items-center gap-1 mt-1.5 text-muted-foreground text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>TikVTV Member</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-5 mt-4">
          {[
            { label: 'Posts',     value: stats.posts },
            { label: 'Followers', value: stats.followers },
            { label: 'Following', value: stats.following },
          ].map(s => (
            <div key={s.label} className="flex flex-col">
              <span className="font-bold text-foreground text-sm">{s.value}</span>
              <span className="text-muted-foreground text-xs">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-12 px-6">
          <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No posts yet</p>
        </div>
      ) : (
        posts.map(p => (
          <div key={p.id} className="px-4 py-3 border-b border-border/30">
            <p className="text-foreground text-sm leading-relaxed">{p.content}</p>
            {p.media_urls?.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1">
                {p.media_urls.slice(0, 2).map((url, i) => (
                  <img key={i} src={url} alt="" className="rounded-lg aspect-square object-cover bg-muted" />
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-2 text-muted-foreground text-xs">
              <span>{timeAgo(p.created_at)}</span>
              <span>· {p.like_count} likes</span>
              <span>· {p.repost_count} reposts</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
